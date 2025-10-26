import { IconSymbol } from "@/components/ui/icon-symbol";
import { AppColors } from "@/constants/theme";
import { telemetryDB, TelemetryLog } from "@/lib/db";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { 
  RefreshControl, 
  StyleSheet, 
  ScrollView, 
  View, 
  Text, 
  ActivityIndicator 
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function LiveMonitorScreen() {
  const [telemetryData, setTelemetryData] = useState<TelemetryLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTelemetryData = async () => {
    try {
      setIsLoading(true);
      // Get last 50 telemetry entries for live monitoring
      const data = await telemetryDB.getTelemetrySince(300); // Last 5 minutes
      setTelemetryData(data.slice(-50)); // Keep only last 50 entries
    } catch (error) {
      console.error('Error loading telemetry data:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadTelemetryData();
    
    // Refresh data every 2 seconds for live monitoring
    const interval = setInterval(loadTelemetryData, 2000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadTelemetryData();
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  const getTemperatureColor = (temp: number) => {
    if (temp < 50) return AppColors.green500;
    if (temp < 70) return AppColors.yellow500;
    return AppColors.red500;
  };

  const getTemperatureStatus = (temp: number) => {
    if (temp < 50) return 'Cool';
    if (temp < 70) return 'Normal';
    return 'Hot';
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#904BFF" />
          <Text style={styles.loadingText}>Loading live telemetry...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>
            Live Monitor
          </Text>
          <Text style={styles.subtitle}>
            Real-time Hardware Telemetry
          </Text>
        </View>

        {/* Current Status Summary */}
        {telemetryData.length > 0 && (
          <View style={styles.statusCard}>
            <Text style={styles.statusTitle}>CURRENT STATUS</Text>
            
            <View style={styles.statusRow}>
              {/* GPU */}
              <View style={styles.statusItem}>
                <IconSymbol
                  size={20}
                  name="cpu"
                  color={getTemperatureColor(telemetryData[0].gpu_temp)}
                />
                <Text style={styles.statusLabel}>GPU</Text>
                <Text style={[styles.statusValue, { color: getTemperatureColor(telemetryData[0].gpu_temp) }]}>
                  {telemetryData[0].gpu_temp}°C
                </Text>
              </View>

              {/* CPU */}
              <View style={styles.statusItem}>
                <IconSymbol
                  size={20}
                  name="cpu"
                  color={getTemperatureColor(telemetryData[0].cpu_temp)}
                />
                <Text style={styles.statusLabel}>CPU</Text>
                <Text style={[styles.statusValue, { color: getTemperatureColor(telemetryData[0].cpu_temp) }]}>
                  {telemetryData[0].cpu_temp}°C
                </Text>
              </View>

              {/* Fan */}
              <View style={styles.statusItem}>
                <IconSymbol
                  size={20}
                  name="fan"
                  color={AppColors.blue500}
                />
                <Text style={styles.statusLabel}>FAN</Text>
                <Text style={styles.statusValue}>
                  {telemetryData[0].fan_rpm}
                </Text>
              </View>

              {/* Power */}
              <View style={styles.statusItem}>
                <IconSymbol
                  size={20}
                  name="bolt.fill"
                  color={AppColors.yellow600}
                />
                <Text style={styles.statusLabel}>POWER</Text>
                <Text style={styles.statusValue}>
                  {telemetryData[0].power_draw}W
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Live Telemetry Feed */}
        <View style={styles.feedContainer}>
          <Text style={styles.feedTitle}>LIVE FEED</Text>
          
          {telemetryData.length === 0 ? (
            <View style={styles.emptyState}>
              <IconSymbol size={48} name="chart.bar" color={AppColors.gray400} />
              <Text style={styles.emptyTitle}>No Live Data</Text>
              <Text style={styles.emptySubtitle}>
                Start the telemetry stream to see live hardware monitoring data
              </Text>
            </View>
          ) : (
            telemetryData.slice().reverse().map((entry, index) => {
              const gpuColor = getTemperatureColor(entry.gpu_temp);
              const cpuColor = getTemperatureColor(entry.cpu_temp);

              return (
                <View key={`${entry.timestamp}-${index}`} style={styles.entryCard}>
                  <View style={styles.entryHeader}>
                    <Text style={styles.entryTime}>{formatTimestamp(entry.timestamp)}</Text>
                    <Text style={styles.entryPower}>{entry.power_draw}W</Text>
                  </View>

                  <View style={styles.entryRow}>
                    {/* GPU */}
                    <View style={styles.entryItem}>
                      <View style={styles.entryItemHeader}>
                            <IconSymbol size={16} name="cpu" color={gpuColor} />
                        <Text style={[styles.entryLabel, { color: gpuColor }]}>GPU</Text>
                      </View>
                      <Text style={[styles.entryValue, { color: gpuColor }]}>
                        {entry.gpu_temp}°C
                      </Text>
                      <Text style={styles.entryStatus}>
                        {getTemperatureStatus(entry.gpu_temp)}
                      </Text>
                    </View>

                    {/* CPU */}
                    <View style={styles.entryItem}>
                      <View style={styles.entryItemHeader}>
                        <IconSymbol size={16} name="cpu" color={cpuColor} />
                        <Text style={[styles.entryLabel, { color: cpuColor }]}>CPU</Text>
                      </View>
                      <Text style={[styles.entryValue, { color: cpuColor }]}>
                        {entry.cpu_temp}°C
                      </Text>
                      <Text style={styles.entryStatus}>
                        {getTemperatureStatus(entry.cpu_temp)}
                      </Text>
                    </View>

                    {/* Fan */}
                    <View style={styles.entryItem}>
                      <View style={styles.entryItemHeader}>
                        <IconSymbol size={16} name="fan" color={AppColors.blue500} />
                        <Text style={[styles.entryLabel, { color: AppColors.blue500 }]}>FAN</Text>
                      </View>
                      <Text style={[styles.entryValue, { color: AppColors.blue500 }]}>
                        {entry.fan_rpm}
                      </Text>
                      <Text style={styles.entryStatus}>RPM</Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
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
    flex: 1,
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
  statusCard: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#334155",
  },
  statusTitle: {
    fontSize: 14,
    color: "#cbd5e1",
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statusItem: {
    alignItems: "center",
    flex: 1,
    gap: 4,
  },
  statusLabel: {
    fontSize: 10,
    color: "#94a3b8",
    fontWeight: "600",
  },
  statusValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f8fafc",
  },
  feedContainer: {
    marginBottom: 24,
  },
  feedTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#f8fafc",
    marginBottom: 12,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#f8fafc",
    marginTop: 12,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
    paddingHorizontal: 24,
  },
  entryCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#334155",
  },
  entryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  entryTime: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
  },
  entryPower: {
    fontSize: 12,
    color: AppColors.yellow600,
    fontWeight: "600",
  },
  entryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  entryItem: {
    flex: 1,
    alignItems: "center",
  },
  entryItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  entryLabel: {
    fontSize: 10,
    fontWeight: "600",
  },
  entryValue: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
  entryStatus: {
    fontSize: 8,
    color: "#666",
    textTransform: "uppercase",
  },
});