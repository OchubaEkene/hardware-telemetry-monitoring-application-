#!/usr/bin/env python3
"""
Hardware Telemetry Streaming Script

This script continuously generates synthetic hardware telemetry data
and sends it to the React Native app via HTTP API.

Usage:
    python scripts/telemetry_stream.py

The script will:
- Generate realistic hardware telemetry values with some noise and occasional spikes
- Send data to the app's telemetry API every 0.5 seconds
- Run indefinitely until interrupted (Ctrl+C)
"""

import time
import random
import requests
import json
import sys
from datetime import datetime

# API endpoint - adjust port if needed
API_URL = "http://localhost:8081/api/telemetry"

def test_api_connection():
    """Test if the API is accessible."""
    try:
        response = requests.get(API_URL, timeout=5)
        if response.status_code == 200:
            print(f"✅ API connection successful at {API_URL}")
            return True
        else:
            print(f"❌ API returned status {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ API connection failed: {e}")
        print("Make sure the React Native app is running on http://localhost:8081")
        return False

def generate_telemetry():
    """Generate realistic hardware telemetry values with noise and occasional spikes."""
    base_time = time.time()
    
    # Base values with some realistic ranges
    base_gpu_temp = 45 + random.random() * 25  # 45-70°C
    base_cpu_temp = 55 + random.random() * 20  # 55-75°C
    base_fan_rpm = 1200 + random.random() * 400  # 1200-1600 RPM
    base_power = 110 + random.random() * 40  # 110-150W
    
    # Add occasional spikes (8% chance)
    if random.random() < 0.08:
        spike_multiplier = 1.3 + random.random() * 0.4  # 1.3x to 1.7x
        base_gpu_temp *= spike_multiplier
        base_cpu_temp *= spike_multiplier
        base_fan_rpm *= spike_multiplier
        base_power *= spike_multiplier
        print(f"🔥 Spike detected! GPU: {base_gpu_temp:.1f}°C, CPU: {base_cpu_temp:.1f}°C")
    
    # Add some noise
    noise_factor = 0.05  # 5% noise
    gpu_temp = base_gpu_temp + (random.random() - 0.5) * base_gpu_temp * noise_factor
    cpu_temp = base_cpu_temp + (random.random() - 0.5) * base_cpu_temp * noise_factor
    fan_rpm = base_fan_rpm + (random.random() - 0.5) * base_fan_rpm * noise_factor
    power_draw = base_power + (random.random() - 0.5) * base_power * noise_factor
    
    return {
        'timestamp': base_time,
        'gpu_temp': round(gpu_temp, 1),
        'cpu_temp': round(cpu_temp, 1),
        'fan_rpm': round(fan_rpm, 0),
        'power_draw': round(power_draw, 1)
    }

def send_telemetry(telemetry_data):
    """Send telemetry data to the API."""
    try:
        response = requests.post(
            API_URL,
            json=telemetry_data,
            headers={'Content-Type': 'application/json'},
            timeout=5
        )
        
        if response.status_code == 200:
            return True
        else:
            print(f"❌ API error: {response.status_code} - {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to send telemetry: {e}")
        return False

def main():
    """Main telemetry streaming loop."""
    print("🚀 Starting Hardware Telemetry Stream")
    print("Press Ctrl+C to stop")
    print("-" * 50)
    
    # Test API connection first
    if not test_api_connection():
        print("❌ Cannot connect to API. Exiting.")
        sys.exit(1)
    
    try:
        count = 0
        success_count = 0
        
        while True:
            # Generate telemetry data
            telemetry = generate_telemetry()
            
            # Send to API
            if send_telemetry(telemetry):
                success_count += 1
            
            # Print status every 10 entries
            count += 1
            if count % 10 == 0:
                timestamp_str = datetime.fromtimestamp(telemetry['timestamp']).strftime('%H:%M:%S')
                success_rate = (success_count / count) * 100
                print(f"[{timestamp_str}] Entry #{count} (Success: {success_rate:.1f}%): "
                      f"GPU: {telemetry['gpu_temp']}°C, "
                      f"CPU: {telemetry['cpu_temp']}°C, "
                      f"Fan: {telemetry['fan_rpm']} RPM, "
                      f"Power: {telemetry['power_draw']}W")
            
            # Wait 0.5 seconds before next reading
            time.sleep(0.5)
            
    except KeyboardInterrupt:
        print("\n🛑 Telemetry stream stopped by user")
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        print(f"📊 Final stats: {success_count}/{count} successful transmissions")

if __name__ == "__main__":
    main()
