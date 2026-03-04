#!/usr/bin/env python3
"""
Hardware telemetry agent — streams real sensor data over WebSocket.

Usage:
    python agent.py [--host HOST] [--port PORT] [--interval SECONDS] [--metrics-port PORT]

Reads:
    - psutil   : CPU temperature (coretemp / k10temp / cpu_thermal / acpitz) + fan RPM
    - pynvml   : GPU temperature + power draw (NVIDIA)

Falls back to synthetic values when sensors are unavailable.

Exports Prometheus metrics on --metrics-port (default 9100).
"""

import argparse
import asyncio
import json
import math
import random
import time
from typing import Optional, Set

from prometheus_client import Gauge, start_http_server

_gpu_gauge   = Gauge('hardware_gpu_temp_celsius', 'GPU temperature in Celsius')
_cpu_gauge   = Gauge('hardware_cpu_temp_celsius', 'CPU temperature in Celsius')
_fan_gauge   = Gauge('hardware_fan_rpm',           'Fan speed in RPM')
_power_gauge = Gauge('hardware_power_draw_watts',  'Power draw in Watts')

try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False
    print("[warn] psutil not installed — CPU sensors will use synthetic data")

try:
    import pynvml
    pynvml.nvmlInit()
    _gpu_handle = pynvml.nvmlDeviceGetHandleByIndex(0)
    PYNVML_AVAILABLE = True
except Exception:
    PYNVML_AVAILABLE = False
    print("[warn] pynvml unavailable or no NVIDIA GPU — GPU sensors will use synthetic data")

import websockets
from websockets.server import WebSocketServerProtocol

connected_clients: Set[WebSocketServerProtocol] = set()

# ── Sensor helpers ────────────────────────────────────────────────────────────

def _cpu_temp_psutil() -> Optional[float]:
    """Return CPU package temperature via psutil, or None."""
    if not PSUTIL_AVAILABLE:
        return None
    try:
        sensors = psutil.sensors_temperatures()
        # Priority order of sensor keys across platforms
        for key in ("coretemp", "k10temp", "cpu_thermal", "acpitz"):
            entries = sensors.get(key, [])
            if entries:
                # Use the first 'Package id 0' / 'Tdie' / first entry
                for e in entries:
                    if "package" in e.label.lower() or "tdie" in e.label.lower():
                        return e.current
                return entries[0].current
    except Exception:
        pass
    return None


def _fan_rpm_psutil() -> Optional[float]:
    """Return first available fan RPM via psutil, or None."""
    if not PSUTIL_AVAILABLE:
        return None
    try:
        fans = psutil.sensors_fans()
        for fan_list in fans.values():
            if fan_list:
                return float(fan_list[0].current)
    except Exception:
        pass
    return None


def _gpu_temp_pynvml() -> Optional[float]:
    """Return GPU temperature via pynvml, or None."""
    if not PYNVML_AVAILABLE:
        return None
    try:
        return float(pynvml.nvmlDeviceGetTemperature(_gpu_handle, pynvml.NVML_TEMPERATURE_GPU))
    except Exception:
        return None


def _gpu_power_pynvml() -> Optional[float]:
    """Return GPU power draw in Watts via pynvml, or None."""
    if not PYNVML_AVAILABLE:
        return None
    try:
        mW = pynvml.nvmlDeviceGetPowerUsage(_gpu_handle)
        return round(mW / 1000.0, 1)
    except Exception:
        return None


# ── Synthetic fallback ────────────────────────────────────────────────────────

_synthetic_phase = random.uniform(0, math.pi * 2)


def _synthetic_value(base: float, amplitude: float, noise: float) -> float:
    t = time.time()
    wave = math.sin(t / 60.0 + _synthetic_phase) * amplitude
    n = (random.random() - 0.5) * noise
    spike = (base * 0.4) if random.random() < 0.04 else 0.0
    return round(base + wave + n + spike, 1)


# ── Build telemetry ───────────────────────────────────────────────────────────

def build_telemetry() -> dict:
    cpu_temp = _cpu_temp_psutil()
    if cpu_temp is None:
        cpu_temp = _synthetic_value(62, 8, 3)

    fan_rpm = _fan_rpm_psutil()
    if fan_rpm is None:
        fan_rpm = round(_synthetic_value(1400, 200, 80))

    gpu_temp = _gpu_temp_pynvml()
    if gpu_temp is None:
        gpu_temp = _synthetic_value(58, 12, 4)

    power_draw = _gpu_power_pynvml()
    if power_draw is None:
        power_draw = _synthetic_value(130, 20, 10)

    return {
        "timestamp": round(time.time(), 3),
        "gpu_temp": round(float(gpu_temp), 1),
        "cpu_temp": round(float(cpu_temp), 1),
        "fan_rpm": int(fan_rpm),
        "power_draw": round(float(power_draw), 1),
    }


# ── WebSocket server ──────────────────────────────────────────────────────────

async def handle_client(ws: WebSocketServerProtocol, path: str) -> None:
    connected_clients.add(ws)
    addr = ws.remote_address
    print(f"[+] client connected: {addr}  (total={len(connected_clients)})")
    try:
        await ws.wait_closed()
    finally:
        connected_clients.discard(ws)
        print(f"[-] client disconnected: {addr}  (total={len(connected_clients)})")


async def telemetry_loop(interval: float) -> None:
    while True:
        data = build_telemetry()
        _gpu_gauge.set(data['gpu_temp'])
        _cpu_gauge.set(data['cpu_temp'])
        _fan_gauge.set(data['fan_rpm'])
        _power_gauge.set(data['power_draw'])
        if connected_clients:
            payload = json.dumps(data)
            dead = set()
            for ws in list(connected_clients):
                try:
                    await ws.send(payload)
                except Exception:
                    dead.add(ws)
            connected_clients.difference_update(dead)
        await asyncio.sleep(interval)


async def main(host: str, port: int, interval: float, metrics_port: int) -> None:
    print(f"[*] Hardware agent starting on ws://{host}:{port}  interval={interval}s")
    print(f"[*] Prometheus metrics on http://{host}:{metrics_port}/metrics")
    if PSUTIL_AVAILABLE:
        print("[*] psutil: CPU temp + fan sensors active")
    if PYNVML_AVAILABLE:
        print("[*] pynvml: NVIDIA GPU sensors active")
    if not PSUTIL_AVAILABLE and not PYNVML_AVAILABLE:
        print("[*] All sensors synthetic — install psutil / pynvml for real data")

    start_http_server(metrics_port)  # daemon thread, doesn't block asyncio

    async with websockets.serve(handle_client, host, port):
        await telemetry_loop(interval)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Hardware telemetry WebSocket agent")
    parser.add_argument("--host", default="0.0.0.0", help="Bind address (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=8765, help="Port (default: 8765)")
    parser.add_argument("--interval", type=float, default=2.0, help="Broadcast interval in seconds (default: 2.0)")
    parser.add_argument("--metrics-port", type=int, default=9100, help="Prometheus metrics port (default: 9100)")
    args = parser.parse_args()

    asyncio.run(main(args.host, args.port, args.interval, args.metrics_port))
