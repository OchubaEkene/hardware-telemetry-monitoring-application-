import { Platform } from 'react-native';

export interface TelemetryLog {
  timestamp: number;
  gpu_temp: number;
  cpu_temp: number;
  fan_rpm: number;
  power_draw: number;
}

class TelemetryDatabase {
  private logs: TelemetryLog[] = [];
  private intervalId: ReturnType<typeof setInterval> | null = null;

  async init(): Promise<void> {
    // Initialize with empty array
    this.logs = [];
    
    // Start generating synthetic telemetry data
    this.startTelemetryGeneration();
  }

  private startTelemetryGeneration(): void {
    // Generate initial data
    this.generateTelemetryBatch(50);
    
    // Generate new data every 2 seconds
    this.intervalId = setInterval(() => {
      this.generateTelemetryBatch(1);
    }, 2000);
  }

  private generateTelemetryBatch(count: number): void {
    for (let i = 0; i < count; i++) {
      const telemetry = this.generateSingleTelemetry();
      this.logs.unshift(telemetry);
    }
    
    // Keep only last 1000 entries to prevent memory issues
    if (this.logs.length > 1000) {
      this.logs.splice(1000);
    }
  }

  private generateSingleTelemetry(): TelemetryLog {
    // Add a small random offset to ensure unique timestamps
    const timestamp = Date.now() / 1000 + Math.random() * 0.001;
    
    // Base values with some realistic ranges
    let baseGpuTemp = 45 + Math.random() * 25; // 45-70°C
    let baseCpuTemp = 55 + Math.random() * 20; // 55-75°C
    let baseFanRpm = 1200 + Math.random() * 400; // 1200-1600 RPM
    let basePower = 110 + Math.random() * 40; // 110-150W
    
    // Add occasional spikes (8% chance)
    if (Math.random() < 0.08) {
      const spikeMultiplier = 1.3 + Math.random() * 0.4; // 1.3x to 1.7x
      baseGpuTemp *= spikeMultiplier;
      baseCpuTemp *= spikeMultiplier;
      baseFanRpm *= spikeMultiplier;
      basePower *= spikeMultiplier;
    }
    
    // Add some noise
    const noiseFactor = 0.05; // 5% noise
    const gpuTemp = baseGpuTemp + (Math.random() - 0.5) * baseGpuTemp * noiseFactor;
    const cpuTemp = baseCpuTemp + (Math.random() - 0.5) * baseCpuTemp * noiseFactor;
    const fanRpm = baseFanRpm + (Math.random() - 0.5) * baseFanRpm * noiseFactor;
    const powerDraw = basePower + (Math.random() - 0.5) * basePower * noiseFactor;
    
    return {
      timestamp,
      gpu_temp: Math.round(gpuTemp * 10) / 10,
      cpu_temp: Math.round(cpuTemp * 10) / 10,
      fan_rpm: Math.round(fanRpm),
      power_draw: Math.round(powerDraw * 10) / 10
    };
  }

  destroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async insertTelemetry(data: TelemetryLog): Promise<void> {
    this.logs.unshift(data);
    // Keep only last 1000 entries to prevent memory issues
    if (this.logs.length > 1000) {
      this.logs.splice(1000);
    }
  }

  async getTelemetrySince(secondsAgo: number): Promise<TelemetryLog[]> {
    const cutoffTime = Date.now() / 1000 - secondsAgo;
    return this.logs.filter(log => log.timestamp >= cutoffTime);
  }

  async getLatestTelemetry(limit: number = 1): Promise<TelemetryLog[]> {
    return this.logs.slice(0, limit);
  }

  async getTelemetryStats(secondsAgo: number): Promise<{
    avgGpuTemp: number;
    avgCpuTemp: number;
    latestFanRpm: number;
    powerTrend: 'up' | 'down' | 'stable';
  }> {
    const cutoffTime = Date.now() / 1000 - secondsAgo;
    const recentLogs = this.logs.filter(log => log.timestamp >= cutoffTime);
    
    if (recentLogs.length === 0) {
      return { avgGpuTemp: 0, avgCpuTemp: 0, latestFanRpm: 0, powerTrend: 'stable' };
    }

    const avgGpuTemp = recentLogs.reduce((sum, log) => sum + log.gpu_temp, 0) / recentLogs.length;
    const avgCpuTemp = recentLogs.reduce((sum, log) => sum + log.cpu_temp, 0) / recentLogs.length;
    const latestFanRpm = recentLogs[0]?.fan_rpm || 0;

    // Calculate power trend
    const recentPower = recentLogs.reduce((sum, log) => sum + log.power_draw, 0) / recentLogs.length;
    const olderLogs = this.logs.filter(log => log.timestamp >= cutoffTime * 2 && log.timestamp < cutoffTime);
    const olderPower = olderLogs.length > 0 ? olderLogs.reduce((sum, log) => sum + log.power_draw, 0) / olderLogs.length : recentPower;

    let powerTrend: 'up' | 'down' | 'stable' = 'stable';
    if (recentPower && olderPower) {
      const diff = recentPower - olderPower;
      if (diff > 5) powerTrend = 'up';
      else if (diff < -5) powerTrend = 'down';
    }

    return { avgGpuTemp, avgCpuTemp, latestFanRpm, powerTrend };
  }

  async detectAnomalies(secondsAgo: number = 600): Promise<{
    gpuAnomalies: TelemetryLog[];
    cpuAnomalies: TelemetryLog[];
    powerAnomalies: TelemetryLog[];
  }> {
    const cutoffTime = Date.now() / 1000 - secondsAgo;
    const recentLogs = this.logs.filter(log => log.timestamp >= cutoffTime);
    
    if (recentLogs.length === 0) {
      return { gpuAnomalies: [], cpuAnomalies: [], powerAnomalies: [] };
    }

    // Calculate baseline stats
    const gpuTemps = recentLogs.map(log => log.gpu_temp);
    const cpuTemps = recentLogs.map(log => log.cpu_temp);
    const powerDraws = recentLogs.map(log => log.power_draw);

    const avgGpu = gpuTemps.reduce((sum, temp) => sum + temp, 0) / gpuTemps.length;
    const avgCpu = cpuTemps.reduce((sum, temp) => sum + temp, 0) / cpuTemps.length;
    const avgPower = powerDraws.reduce((sum, power) => sum + power, 0) / powerDraws.length;

    const stdGpu = Math.sqrt(gpuTemps.reduce((sum, temp) => sum + Math.pow(temp - avgGpu, 2), 0) / gpuTemps.length);
    const stdCpu = Math.sqrt(cpuTemps.reduce((sum, temp) => sum + Math.pow(temp - avgCpu, 2), 0) / cpuTemps.length);
    const stdPower = Math.sqrt(powerDraws.reduce((sum, power) => sum + Math.pow(power - avgPower, 2), 0) / powerDraws.length);

    const threshold = 2; // 2 standard deviations
    
    const gpuAnomalies = recentLogs.filter(log => 
      Math.abs(log.gpu_temp - avgGpu) > threshold * stdGpu
    );
    
    const cpuAnomalies = recentLogs.filter(log => 
      Math.abs(log.cpu_temp - avgCpu) > threshold * stdCpu
    );
    
    const powerAnomalies = recentLogs.filter(log => 
      Math.abs(log.power_draw - avgPower) > threshold * stdPower
    );

    return { gpuAnomalies, cpuAnomalies, powerAnomalies };
  }
}

export const telemetryDB = new TelemetryDatabase();
