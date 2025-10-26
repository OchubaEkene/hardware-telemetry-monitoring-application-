import { telemetryDB } from "@/lib/db";

export const analysisServer = {
  name: "analysis-server",
  version: "1.0.0",
  description: "Hardware performance analysis and insights server",
  
  tools: {
    analyzePerformance: {
      name: "analyzePerformance",
      description: "Analyze overall hardware performance and provide insights",
      inputSchema: {
        type: "object",
        properties: {
          seconds: {
            type: "number",
            description: "Time window for performance analysis",
            default: 3600
          }
        },
        required: ["seconds"]
      },
      handler: async ({ seconds }: { seconds: number }) => {
        await telemetryDB.init();
        const data = await telemetryDB.getTelemetrySince(seconds);
        const stats = await telemetryDB.getTelemetryStats(seconds);
        const anomalies = await telemetryDB.detectAnomalies(seconds);
        
        // Performance analysis
        const analysis = {
          thermalPerformance: {
            gpuTemp: {
              current: data[data.length - 1]?.gpu_temp || 0,
              average: stats.avgGpuTemp,
              status: stats.avgGpuTemp < 70 ? "excellent" : stats.avgGpuTemp < 80 ? "good" : "concerning"
            },
            cpuTemp: {
              current: data[data.length - 1]?.cpu_temp || 0,
              average: stats.avgCpuTemp, 
              status: stats.avgCpuTemp < 70 ? "excellent" : stats.avgCpuTemp < 80 ? "good" : "concerning"
            }
          },
          powerEfficiency: {
            current: data[data.length - 1]?.power_draw || 0,
            average: 0, // Will calculate from data
            status: "efficient"
          },
          coolingPerformance: {
            current: data[data.length - 1]?.fan_rpm || 0,
            average: stats.latestFanRpm,
            status: stats.latestFanRpm > 1500 ? "active" : stats.latestFanRpm > 1000 ? "moderate" : "low"
          },
          stability: {
            anomalyCount: anomalies.gpuAnomalies.length + anomalies.cpuAnomalies.length + anomalies.powerAnomalies.length,
            status: anomalies.gpuAnomalies.length + anomalies.cpuAnomalies.length + anomalies.powerAnomalies.length === 0 ? "stable" : "unstable"
          }
        };
        
        return {
          success: true,
          analysis: analysis,
          timeWindow: `${seconds} seconds`,
          overallScore: calculateOverallScore(analysis),
          insights: generateInsights(analysis)
        };
      }
    },

    getHealthStatus: {
      name: "getHealthStatus",
      description: "Get current hardware health status",
      inputSchema: {
        type: "object",
        properties: {},
        required: []
      },
      handler: async () => {
        await telemetryDB.init();
        const latestArray = await telemetryDB.getLatestTelemetry(1);
        const recentAnomalies = await telemetryDB.detectAnomalies(300); // Last 5 minutes
        
        if (!latestArray || latestArray.length === 0) {
          return {
            success: false,
            error: "No telemetry data available"
          };
        }
        
        const latest = latestArray[0];
        
        const healthStatus = {
          overall: "healthy",
          components: {
            gpu: {
              temperature: latest.gpu_temp,
              status: latest.gpu_temp < 70 ? "excellent" : latest.gpu_temp < 80 ? "good" : "warning"
            },
            cpu: {
              temperature: latest.cpu_temp,
              status: latest.cpu_temp < 70 ? "excellent" : latest.cpu_temp < 80 ? "good" : "warning"
            },
            cooling: {
              fanRpm: latest.fan_rpm,
              status: latest.fan_rpm > 1500 ? "active" : latest.fan_rpm > 1000 ? "moderate" : "low"
            },
            power: {
              draw: latest.power_draw,
              status: latest.power_draw < 150 ? "efficient" : latest.power_draw < 200 ? "moderate" : "high"
            }
          },
          anomalies: {
            recent: recentAnomalies.gpuAnomalies.length + recentAnomalies.cpuAnomalies.length + recentAnomalies.powerAnomalies.length,
            status: recentAnomalies.gpuAnomalies.length + recentAnomalies.cpuAnomalies.length + recentAnomalies.powerAnomalies.length === 0 ? "none" : "detected"
          },
          timestamp: new Date().toISOString()
        };
        
        return {
          success: true,
          health: healthStatus
        };
      }
    }
  }
};

function calculateOverallScore(analysis: any): number {
  let score = 100;
  
  // Deduct points for concerning temperatures
  if (analysis.thermalPerformance.gpuTemp.status === "concerning") score -= 20;
  else if (analysis.thermalPerformance.gpuTemp.status === "good") score -= 10;
  
  if (analysis.thermalPerformance.cpuTemp.status === "concerning") score -= 20;
  else if (analysis.thermalPerformance.cpuTemp.status === "good") score -= 10;
  
  // Deduct points for power inefficiency
  if (analysis.powerEfficiency.status === "high") score -= 15;
  else if (analysis.powerEfficiency.status === "moderate") score -= 5;
  
  // Deduct points for instability
  if (analysis.stability.status === "unstable") score -= 25;
  
  return Math.max(0, score);
}

function generateInsights(analysis: any): string[] {
  const insights = [];
  
  if (analysis.thermalPerformance.gpuTemp.status === "excellent" && analysis.thermalPerformance.cpuTemp.status === "excellent") {
    insights.push("Excellent thermal performance - both GPU and CPU temperatures are optimal");
  }
  
  if (analysis.powerEfficiency.status === "efficient") {
    insights.push("Power consumption is efficient for current workload");
  }
  
  if (analysis.coolingPerformance.status === "active") {
    insights.push("Cooling system is actively maintaining optimal temperatures");
  }
  
  if (analysis.stability.status === "stable") {
    insights.push("System is running stably with no anomalies detected");
  }
  
  return insights;
}
