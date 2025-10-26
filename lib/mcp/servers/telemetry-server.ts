import { telemetryDB } from "@/lib/db";

export const telemetryServer = {
  name: "telemetry-server",
  version: "1.0.0",
  description: "Hardware telemetry data access server",
  
  tools: {
    getRecentTelemetry: {
      name: "getRecentTelemetry",
      description: "Get recent telemetry data for the specified time window",
      inputSchema: {
        type: "object",
        properties: {
          seconds: {
            type: "number",
            description: "Number of seconds to look back",
            default: 3600
          }
        },
        required: ["seconds"]
      },
      handler: async ({ seconds }: { seconds: number }) => {
        await telemetryDB.init();
        const data = await telemetryDB.getTelemetrySince(seconds);
        return {
          success: true,
          data: data,
          count: data.length,
          timeWindow: `${seconds} seconds`,
          latest: data[data.length - 1] || null
        };
      }
    },

    getLatestTelemetry: {
      name: "getLatestTelemetry", 
      description: "Get the most recent telemetry reading",
      inputSchema: {
        type: "object",
        properties: {},
        required: []
      },
      handler: async () => {
        await telemetryDB.init();
        const latest = await telemetryDB.getLatestTelemetry();
        return {
          success: true,
          data: latest[0] || null,
          timestamp: latest[0] ? new Date().toISOString() : null
        };
      }
    },

    getTelemetryStats: {
      name: "getTelemetryStats",
      description: "Get statistical analysis of telemetry data",
      inputSchema: {
        type: "object", 
        properties: {
          seconds: {
            type: "number",
            description: "Time window for statistics",
            default: 3600
          }
        },
        required: ["seconds"]
      },
      handler: async ({ seconds }: { seconds: number }) => {
        await telemetryDB.init();
        const stats = await telemetryDB.getTelemetryStats(seconds);
        return {
          success: true,
          stats: stats,
          timeWindow: `${seconds} seconds`,
          summary: {
            avgGpuTemp: stats.avgGpuTemp.toFixed(1),
            avgCpuTemp: stats.avgCpuTemp.toFixed(1),
            latestFanRpm: stats.latestFanRpm.toFixed(0),
            powerTrend: stats.powerTrend
          }
        };
      }
    }
  }
};
