import { IconSymbol } from "@/components/ui/icon-symbol";
import { AppColors } from "@/constants/theme";
import { telemetryDB, TelemetryLog } from "@/lib/db";
import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  ScrollView,
  View,
  Text,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

interface AnalyticsData {
  stats: {
    avgGpuTemp: number;
    avgCpuTemp: number;
    avgFanRpm: number;
    avgPower: number;
  };
  anomalies: any[];
  trends: {
    gpuTrend: 'up' | 'down' | 'stable';
    cpuTrend: 'up' | 'down' | 'stable';
    powerTrend: 'up' | 'down' | 'stable';
  };
}

export default function MCPAnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadAnalytics = async () => {
    try {
      await telemetryDB.init();
      
      const stats = await telemetryDB.getTelemetryStats(3600); // Last hour
      const anomalies = await telemetryDB.detectAnomalies(3600);
      const data = await telemetryDB.getTelemetrySince(3600);
      
      // Calculate trends (simplified)
      const trends = {
        gpuTrend: 'stable' as const,
        cpuTrend: 'stable' as const,
        powerTrend: stats.powerTrend || 'stable' as const,
      };
      
      setAnalytics({
        stats: {
          avgGpuTemp: stats.avgGpuTemp,
          avgCpuTemp: stats.avgCpuTemp,
          avgFanRpm: stats.avgFanRpm || 0,
          avgPower: stats.avgPower || 0,
        },
        anomalies,
        trends,
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
    
    // Refresh every 10 seconds
    const interval = setInterval(loadAnalytics, 10000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadAnalytics();
  };

  const getTemperatureColor = (temp: number) => {
    if (temp < 50) return AppColors.green500;
    if (temp < 70) return AppColors.yellow500;
    return AppColors.red500;
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Loading analytics...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={{
          ...styles.content,
          paddingTop: insets.top,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>MCP Analytics</Text>
          <Text style={styles.subtitle}>Performance insights and trends</Text>
        </View>

        {analytics && (
          <>
            {/* Performance Metrics */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>PERFORMANCE METRICS</Text>
              
              <View style={styles.metricsGrid}>
                <View style={styles.metricItem}>
                  <IconSymbol
                    size={24}
                    name="cpu"
                    color={getTemperatureColor(analytics.stats.avgGpuTemp)}
                  />
                  <Text style={styles.metricLabel}>Avg GPU</Text>
                  <Text style={[styles.metricValue, { color: getTemperatureColor(analytics.stats.avgGpuTemp) }]}>
                    {analytics.stats.avgGpuTemp.toFixed(1)}°C
                  </Text>
                </View>

                <View style={styles.metricItem}>
                  <IconSymbol
                    size={24}
                    name="cpu"
                    color={getTemperatureColor(analytics.stats.avgCpuTemp)}
                  />
                  <Text style={styles.metricLabel}>Avg CPU</Text>
                  <Text style={[styles.metricValue, { color: getTemperatureColor(analytics.stats.avgCpuTemp) }]}>
                    {analytics.stats.avgCpuTemp.toFixed(1)}°C
                  </Text>
                </View>

                <View style={styles.metricItem}>
                  <IconSymbol
                    size={24}
                    name="fan"
                    color={AppColors.blue500}
                  />
                  <Text style={styles.metricLabel}>Avg Fan</Text>
                  <Text style={styles.metricValue}>
                    {analytics.stats.avgFanRpm.toFixed(0)} RPM
                  </Text>
                </View>

                <View style={styles.metricItem}>
                  <IconSymbol
                    size={24}
                    name="bolt.fill"
                    color={AppColors.yellow500}
                  />
                  <Text style={styles.metricLabel}>Power</Text>
                  <Text style={styles.metricValue}>
                    {analytics.stats.avgPower.toFixed(1)}W
                  </Text>
                </View>
              </View>
            </View>

            {/* Anomalies */}
            {analytics.anomalies.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>DETECTED ANOMALIES</Text>
                <Text style={styles.anomalyCount}>
                  {analytics.anomalies.length} anomaly(ies) detected in the last hour
                </Text>
              </View>
            )}

            {/* Trends */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>TRENDS</Text>
              <View style={styles.trendsContainer}>
                <View style={styles.trendItem}>
                  <Text style={styles.trendLabel}>GPU Trend</Text>
                  <Text style={styles.trendValue}>
                    {analytics.trends.gpuTrend.toUpperCase()}
                  </Text>
                </View>
                <View style={styles.trendItem}>
                  <Text style={styles.trendLabel}>CPU Trend</Text>
                  <Text style={styles.trendValue}>
                    {analytics.trends.cpuTrend.toUpperCase()}
                  </Text>
                </View>
                <View style={styles.trendItem}>
                  <Text style={styles.trendLabel}>Power Trend</Text>
                  <Text style={styles.trendValue}>
                    {analytics.trends.powerTrend.toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#94a3b8",
  },
  content: {
    paddingHorizontal: 16,
  },
  header: {
    alignItems: "center",
    marginTop: 16,
    marginBottom: 24,
    gap: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#f8fafc",
  },
  subtitle: {
    fontSize: 16,
    color: "#94a3b8",
    textAlign: "center",
  },
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#334155",
  },
  cardTitle: {
    fontSize: 16,
    color: "#cbd5e1",
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 16,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 16,
  },
  metricItem: {
    alignItems: "center",
    flex: 1,
    minWidth: "45%",
    gap: 8,
  },
  metricLabel: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "600",
  },
  metricValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#f8fafc",
  },
  anomalyCount: {
    fontSize: 14,
    color: AppColors.yellow500,
    textAlign: "center",
    marginTop: 8,
  },
  trendsContainer: {
    gap: 12,
  },
  trendItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  trendLabel: {
    fontSize: 14,
    color: "#94a3b8",
    fontWeight: "600",
  },
  trendValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f8fafc",
  },
});
