"""
AI Insights Service — Claude-powered SRE analysis for hardware metrics.
Queries Prometheus for historical data, analyses trends/anomalies, returns JSON.
"""

import os
import json
import logging
from datetime import datetime, timezone
from typing import Optional

import httpx
import anthropic
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

PROMETHEUS_URL = os.getenv("PROMETHEUS_URL", "http://localhost:9090")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

app = FastAPI(title="AI Insights Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

claude = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

METRICS = {
    "gpu_temp": "hardware_gpu_temp_celsius",
    "cpu_temp": "hardware_cpu_temp_celsius",
    "fan_rpm": "hardware_fan_rpm",
    "power_draw": "hardware_power_draw_watts",
}

THRESHOLDS = {
    "gpu_temp":   {"warning": 70, "critical": 80},
    "cpu_temp":   {"warning": 70, "critical": 80},
    "fan_rpm":    {"low_warning": 1000},
    "power_draw": {"warning": 180, "critical": 200},
}


# ─── Prometheus helpers ────────────────────────────────────────────────────────

async def query_range(client: httpx.AsyncClient, metric: str, window_minutes: int) -> list[dict]:
    """Fetch time-series data for a metric over the given window."""
    end = datetime.now(timezone.utc)
    start = end.timestamp() - window_minutes * 60
    try:
        resp = await client.get(
            f"{PROMETHEUS_URL}/api/v1/query_range",
            params={
                "query": metric,
                "start": start,
                "end": end.timestamp(),
                "step": max(window_minutes * 3, 15),   # ~20 points
            },
            timeout=10.0,
        )
        resp.raise_for_status()
        results = resp.json().get("data", {}).get("result", [])
        if results:
            return [(float(ts), float(val)) for ts, val in results[0].get("values", [])]
        return []
    except Exception as exc:
        logger.warning("Prometheus range query failed for %s: %s", metric, exc)
        return []


async def fetch_active_alerts(client: httpx.AsyncClient) -> list[dict]:
    """Fetch firing alerts from Prometheus Alertmanager API."""
    try:
        resp = await client.get(f"{PROMETHEUS_URL}/api/v1/alerts", timeout=5.0)
        resp.raise_for_status()
        alerts = resp.json().get("data", {}).get("alerts", [])
        return [
            {
                "name": a.get("labels", {}).get("alertname", "unknown"),
                "severity": a.get("labels", {}).get("severity", "unknown"),
                "state": a.get("state", "unknown"),
                "summary": a.get("annotations", {}).get("summary", ""),
            }
            for a in alerts
            if a.get("state") == "firing"
        ]
    except Exception as exc:
        logger.warning("Failed to fetch alerts: %s", exc)
        return []


def compute_stats(values: list[tuple]) -> dict:
    """Return avg/min/max/last/trend for a list of (timestamp, value) pairs."""
    if not values:
        return {"avg": None, "min": None, "max": None, "last": None, "trend": "unknown"}
    vals = [v for _, v in values]
    avg = sum(vals) / len(vals)
    mn = min(vals)
    mx = max(vals)
    last = vals[-1]
    # Simple trend: compare first-third vs last-third mean
    third = max(len(vals) // 3, 1)
    early_mean = sum(vals[:third]) / third
    late_mean = sum(vals[-third:]) / third
    if late_mean > early_mean + 0.5:
        trend = "rising"
    elif late_mean < early_mean - 0.5:
        trend = "falling"
    else:
        trend = "stable"
    return {"avg": round(avg, 2), "min": round(mn, 2), "max": round(mx, 2), "last": round(last, 2), "trend": trend}


def build_prompt(stats: dict, active_alerts: list[dict], question: Optional[str]) -> str:
    lines = ["Current hardware metrics snapshot:"]
    for key, s in stats.items():
        if s["last"] is None:
            lines.append(f"  {key}: no data")
            continue
        unit = "°C" if "temp" in key else (" RPM" if "rpm" in key else "W")
        lines.append(
            f"  {key}: avg={s['avg']}{unit} max={s['max']}{unit} last={s['last']}{unit} trend={s['trend']}"
        )

    thresholds_text = (
        "Thresholds: GPU/CPU temp warning>70°C critical>80°C | "
        "Power draw warning>180W critical>200W | Fan RPM low<1000 RPM"
    )

    alerts_text = "Active alerts: none"
    if active_alerts:
        alerts_text = "Active alerts:\n" + "\n".join(
            f"  - [{a['severity'].upper()}] {a['name']}: {a['summary']}" for a in active_alerts
        )

    question_text = f"\nUser question: {question}" if question else ""

    return (
        "\n".join(lines)
        + "\n\n"
        + thresholds_text
        + "\n\n"
        + alerts_text
        + question_text
        + "\n\nRespond with a single valid JSON object matching the schema provided in the system prompt."
    )


SYSTEM_PROMPT = """You are an enterprise data center SRE AI specialising in GPU/HVAC/power analysis.
You analyse hardware telemetry metrics and return structured diagnostic reports.

Always respond with ONLY a valid JSON object — no markdown, no code fences, no extra text.

Required schema:
{
  "health_score": <integer 0-100>,
  "summary": "<one paragraph plain-text summary>",
  "anomalies": [{"metric": "<name>", "value": <number>, "severity": "info|warning|critical", "detail": "<string>"}],
  "recommendations": ["<string>", ...],
  "active_alerts": [{"name": "<string>", "severity": "<string>", "detail": "<string>"}]
}

health_score guidelines:
  90-100: all metrics nominal
  70-89:  minor concerns
  50-69:  moderate issues
  0-49:   critical problems requiring immediate action"""


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    """Ping Prometheus and return service status."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{PROMETHEUS_URL}/-/ready", timeout=3.0)
            prometheus_status = "up" if resp.status_code == 200 else "down"
    except Exception:
        prometheus_status = "down"
    return {"status": "ok", "prometheus": prometheus_status}


@app.get("/insights")
async def insights(
    window_minutes: int = Query(60, ge=1, le=1440),
    question: Optional[str] = Query(None),
):
    """
    Query Prometheus for hardware metrics, analyse with Claude, return structured JSON.
    """
    async with httpx.AsyncClient() as client:
        # 1. Fetch metric time-series in parallel
        import asyncio
        series = await asyncio.gather(
            *[query_range(client, prom_name, window_minutes) for prom_name in METRICS.values()]
        )
        active_alerts = await fetch_active_alerts(client)

    # 2. Compute stats per metric
    metric_keys = list(METRICS.keys())
    stats = {key: compute_stats(series[i]) for i, key in enumerate(metric_keys)}

    # 3. Build prompt and call Claude
    user_prompt = build_prompt(stats, active_alerts, question)

    try:
        message = claude.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )
        raw = message.content[0].text.strip()
        # Strip markdown fences if Claude adds them despite instructions
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        claude_data = json.loads(raw)
    except json.JSONDecodeError as exc:
        logger.error("Claude returned non-JSON: %s", exc)
        raise HTTPException(status_code=502, detail="AI service returned invalid JSON")
    except anthropic.APIError as exc:
        logger.error("Anthropic API error: %s", exc)
        raise HTTPException(status_code=502, detail=f"AI service error: {exc}")

    return {
        "health_score": claude_data.get("health_score", 0),
        "summary": claude_data.get("summary", ""),
        "anomalies": claude_data.get("anomalies", []),
        "recommendations": claude_data.get("recommendations", []),
        "metrics_snapshot": stats,
        "active_alerts": claude_data.get("active_alerts", active_alerts),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/alerts/webhook")
async def alerts_webhook(payload: dict):
    """
    Receive Prometheus Alertmanager webhook, ask Claude to explain and suggest remediation.
    """
    alerts = payload.get("alerts", [])
    if not alerts:
        raise HTTPException(status_code=400, detail="No alerts in payload")

    alert = alerts[0]
    labels = alert.get("labels", {})
    annotations = alert.get("annotations", {})
    alert_name = labels.get("alertname", "unknown")
    severity = labels.get("severity", "unknown")
    summary = annotations.get("summary", "")
    description = annotations.get("description", "")

    user_prompt = (
        f"A Prometheus alert has fired in the data center:\n\n"
        f"Alert: {alert_name}\n"
        f"Severity: {severity}\n"
        f"Summary: {summary}\n"
        f"Description: {description}\n\n"
        "Explain what this alert means for the data center and provide step-by-step immediate remediation actions. "
        "Respond with ONLY valid JSON: "
        '{"explanation": "<string>", "remediation_steps": ["<string>", ...]}'
    )

    try:
        message = claude.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=512,
            messages=[{"role": "user", "content": user_prompt}],
        )
        raw = message.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        claude_data = json.loads(raw)
    except (json.JSONDecodeError, anthropic.APIError) as exc:
        logger.error("Alert webhook AI error: %s", exc)
        raise HTTPException(status_code=502, detail=str(exc))

    return {
        "alert_name": alert_name,
        "severity": severity,
        "explanation": claude_data.get("explanation", ""),
        "remediation_steps": claude_data.get("remediation_steps", []),
    }
