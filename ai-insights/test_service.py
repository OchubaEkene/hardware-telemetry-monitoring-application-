"""
Tests for ai-insights/service.py
Covers: compute_stats, build_prompt, formatters, and live endpoint smoke-tests
(live tests require the server to be running on localhost:8080)
"""

import json
import pytest
import httpx
from unittest.mock import AsyncMock, MagicMock, patch

# ── Unit tests (no server required) ──────────────────────────────────────────

from service import compute_stats, build_prompt, THRESHOLDS


class TestComputeStats:
    def test_empty_returns_nones(self):
        s = compute_stats([])
        assert s["avg"] is None
        assert s["last"] is None
        assert s["trend"] == "unknown"

    def test_single_value(self):
        s = compute_stats([(1000.0, 50.0)])
        assert s["avg"] == 50.0
        assert s["min"] == 50.0
        assert s["max"] == 50.0
        assert s["last"] == 50.0
        assert s["trend"] == "stable"

    def test_rising_trend(self):
        # Values clearly increasing
        values = [(float(i), float(i * 10)) for i in range(1, 10)]
        s = compute_stats(values)
        assert s["trend"] == "rising"
        assert s["last"] == 90.0

    def test_falling_trend(self):
        values = [(float(i), float(100 - i * 10)) for i in range(1, 10)]
        s = compute_stats(values)
        assert s["trend"] == "falling"

    def test_stable_trend(self):
        values = [(float(i), 55.0) for i in range(10)]
        s = compute_stats(values)
        assert s["trend"] == "stable"

    def test_rounding(self):
        values = [(1.0, 1/3), (2.0, 2/3), (3.0, 1.0)]
        s = compute_stats(values)
        assert s["avg"] == round((1/3 + 2/3 + 1.0) / 3, 2)


class TestBuildPrompt:
    def _sample_stats(self):
        return {
            "gpu_temp":   {"avg": 60.0, "min": 55.0, "max": 70.0, "last": 62.0, "trend": "stable"},
            "cpu_temp":   {"avg": 50.0, "min": 45.0, "max": 55.0, "last": 51.0, "trend": "stable"},
            "fan_rpm":    {"avg": 1400.0, "min": 1200.0, "max": 1600.0, "last": 1400.0, "trend": "stable"},
            "power_draw": {"avg": 130.0, "min": 110.0, "max": 155.0, "last": 132.0, "trend": "rising"},
        }

    def test_contains_metric_values(self):
        prompt = build_prompt(self._sample_stats(), [], None)
        assert "gpu_temp" in prompt
        assert "62.0" in prompt  # last value

    def test_no_alerts(self):
        prompt = build_prompt(self._sample_stats(), [], None)
        assert "Active alerts: none" in prompt

    def test_active_alert_included(self):
        alerts = [{"name": "GPUTempCritical", "severity": "critical", "state": "firing", "summary": "GPU over 80C"}]
        prompt = build_prompt(self._sample_stats(), alerts, None)
        assert "GPUTempCritical" in prompt
        assert "CRITICAL" in prompt

    def test_user_question_included(self):
        prompt = build_prompt(self._sample_stats(), [], "Is my GPU overheating?")
        assert "Is my GPU overheating?" in prompt

    def test_no_data_metric(self):
        stats = self._sample_stats()
        stats["gpu_temp"] = {"avg": None, "min": None, "max": None, "last": None, "trend": "unknown"}
        prompt = build_prompt(stats, [], None)
        assert "gpu_temp: no data" in prompt

    def test_thresholds_text_present(self):
        prompt = build_prompt(self._sample_stats(), [], None)
        assert "Thresholds" in prompt
        assert "80" in prompt  # critical threshold


class TestThresholds:
    def test_gpu_critical_threshold(self):
        assert THRESHOLDS["gpu_temp"]["critical"] == 80

    def test_cpu_critical_threshold(self):
        assert THRESHOLDS["cpu_temp"]["critical"] == 80

    def test_power_warning_threshold(self):
        assert THRESHOLDS["power_draw"]["warning"] == 180

    def test_fan_low_warning_threshold(self):
        assert THRESHOLDS["fan_rpm"]["low_warning"] == 1000


# ── Integration / smoke tests (mock Claude, real HTTP server) ─────────────────

import threading
import time
import uvicorn
from service import app

CLAUDE_INSIGHTS_RESPONSE = json.dumps({
    "health_score": 87,
    "summary": "System is operating within normal parameters. GPU temperature is slightly elevated but within acceptable range.",
    "anomalies": [{"metric": "gpu_temp", "value": 75.0, "severity": "warning", "detail": "Approaching warning threshold"}],
    "recommendations": ["Monitor GPU cooling", "Check fan filters"],
    "active_alerts": [],
})

CLAUDE_ALERT_RESPONSE = json.dumps({
    "explanation": "GPU temperature has exceeded the critical threshold of 80°C for over 1 minute.",
    "remediation_steps": ["Check cooling system", "Reduce GPU load", "Inspect thermal paste"],
})

_MOCK_CONTENT_BLOCK = MagicMock()
_MOCK_CONTENT_BLOCK.text = CLAUDE_INSIGHTS_RESPONSE

_MOCK_MSG = MagicMock()
_MOCK_MSG.content = [_MOCK_CONTENT_BLOCK]

_MOCK_ALERT_BLOCK = MagicMock()
_MOCK_ALERT_BLOCK.text = CLAUDE_ALERT_RESPONSE

_MOCK_ALERT_MSG = MagicMock()
_MOCK_ALERT_MSG.content = [_MOCK_ALERT_BLOCK]

TEST_PORT = 18080
BASE_URL = f"http://localhost:{TEST_PORT}"


@pytest.fixture(scope="module")
def live_server():
    """Start the FastAPI app in a background thread for integration tests."""
    config = uvicorn.Config(app, host="127.0.0.1", port=TEST_PORT, log_level="error")
    server = uvicorn.Server(config)
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    # Wait until server is ready
    for _ in range(20):
        try:
            httpx.get(f"{BASE_URL}/health", timeout=1)
            break
        except Exception:
            time.sleep(0.2)
    yield
    server.should_exit = True


@pytest.mark.integration
class TestLiveEndpoints:
    """Integration tests — run the FastAPI app in-process with a mocked Claude client."""

    def test_health_ok(self, live_server):
        resp = httpx.get(f"{BASE_URL}/health", timeout=5)
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "ok"
        assert "prometheus" in body

    def test_insights_returns_required_fields(self, live_server):
        call_tracker = {"count": 0}

        def side_effect(**kwargs):
            call_tracker["count"] += 1
            return _MOCK_MSG

        import service
        with patch.object(service.claude.messages, "create", side_effect=side_effect):
            resp = httpx.get(f"{BASE_URL}/insights?window_minutes=5", timeout=15)

        assert resp.status_code == 200
        body = resp.json()
        assert "health_score" in body
        assert isinstance(body["health_score"], int)
        assert 0 <= body["health_score"] <= 100
        assert "summary" in body and len(body["summary"]) > 0
        assert "anomalies" in body and isinstance(body["anomalies"], list)
        assert "recommendations" in body and isinstance(body["recommendations"], list)
        assert "metrics_snapshot" in body
        assert "generated_at" in body
        assert call_tracker["count"] == 1

    def test_insights_with_question(self, live_server):
        import service
        with patch.object(service.claude.messages, "create", return_value=_MOCK_MSG):
            resp = httpx.get(
                f"{BASE_URL}/insights?window_minutes=5&question=Is+my+GPU+overheating",
                timeout=15,
            )
        assert resp.status_code == 200
        assert "health_score" in resp.json()

    def test_alerts_webhook_bad_payload(self, live_server):
        resp = httpx.post(f"{BASE_URL}/alerts/webhook", json={}, timeout=5)
        assert resp.status_code == 400

    def test_alerts_webhook_valid_payload(self, live_server):
        import service
        with patch.object(service.claude.messages, "create", return_value=_MOCK_ALERT_MSG):
            payload = {
                "alerts": [
                    {
                        "labels": {"alertname": "HardwareGPUTempCritical", "severity": "critical"},
                        "annotations": {
                            "summary": "GPU temperature exceeded 80C",
                            "description": "GPU temp is 85C for more than 1 minute",
                        },
                        "state": "firing",
                    }
                ]
            }
            resp = httpx.post(f"{BASE_URL}/alerts/webhook", json=payload, timeout=15)

        assert resp.status_code == 200
        body = resp.json()
        assert body["alert_name"] == "HardwareGPUTempCritical"
        assert body["severity"] == "critical"
        assert "explanation" in body
        assert "remediation_steps" in body
        assert isinstance(body["remediation_steps"], list)
