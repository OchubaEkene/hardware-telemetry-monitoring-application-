import { telemetryDB } from "@/lib/db";

export const anomalyServer = {
  name: "anomaly-server",
  version: "1.0.0", 
  description: "Hardware anomaly detection and analysis server",
  
  tools: {
    detectAnomalies: {
      name: "detectAnomalies",
      description: "Detect anomalies in hardware telemetry data",
      inputSchema: {
        type: "object",
        properties: {
          seconds: {
            type: "number",
            description: "Time window for anomaly detection",
            default: 3600
          },
          threshold: {
            type: "number", 
            description: "Anomaly detection threshold (standard deviations)",
            default: 2.0
          }
        },
        required: ["seconds"]
      },
      handler: async ({ seconds, threshold = 2.0 }: { seconds: number, threshold?: number }) => {
        await telemetryDB.init();
        const anomalies = await telemetryDB.detectAnomalies(seconds);
        
        return {
          success: true,
          anomalies: anomalies,
          summary: {
            totalAnomalies: anomalies.gpuAnomalies.length + anomalies.cpuAnomalies.length + anomalies.powerAnomalies.length,
            gpuAnomalies: anomalies.gpuAnomalies.length,
            cpuAnomalies: anomalies.cpuAnomalies.length,
            powerAnomalies: anomalies.powerAnomalies.length,
            threshold: threshold
          },
          timeWindow: `${seconds} seconds`
        };
      }
    },

    getAnomalyReport: {
      name: "getAnomalyReport",
      description: "Get a detailed anomaly report with recommendations",
      inputSchema: {
        type: "object",
        properties: {
          seconds: {
            type: "number",
            description: "Time window for anomaly analysis", 
            default: 3600
          }
        },
        required: ["seconds"]
      },
      handler: async ({ seconds }: { seconds: number }) => {
        await telemetryDB.init();
        const anomalies = await telemetryDB.detectAnomalies(seconds);
        const stats = await telemetryDB.getTelemetryStats(seconds);
        
        // Generate recommendations based on anomalies
        const recommendations = [];
        
        if (anomalies.gpuAnomalies.length > 0) {
          recommendations.push({
            type: "GPU_TEMPERATURE",
            severity: "warning",
            message: `${anomalies.gpuAnomalies.length} GPU temperature anomalies detected`,
            recommendation: "Check GPU cooling system and thermal paste"
          });
        }
        
        if (anomalies.cpuAnomalies.length > 0) {
          recommendations.push({
            type: "CPU_TEMPERATURE", 
            severity: "warning",
            message: `${anomalies.cpuAnomalies.length} CPU temperature anomalies detected`,
            recommendation: "Check CPU cooler and case ventilation"
          });
        }
        
        if (anomalies.powerAnomalies.length > 0) {
          recommendations.push({
            type: "POWER_DRAW",
            severity: "info", 
            message: `${anomalies.powerAnomalies.length} power draw anomalies detected`,
            recommendation: "Monitor power consumption patterns"
          });
        }
        
        return {
          success: true,
          report: {
            timeWindow: `${seconds} seconds`,
            totalAnomalies: anomalies.gpuAnomalies.length + anomalies.cpuAnomalies.length + anomalies.powerAnomalies.length,
            anomalies: anomalies,
            statistics: stats,
            recommendations: recommendations,
            overallHealth: recommendations.length === 0 ? "excellent" : "needs_attention"
          }
        };
      }
    }
  }
};
