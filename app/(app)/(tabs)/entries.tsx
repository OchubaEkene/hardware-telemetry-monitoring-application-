import { IconSymbol } from "@/components/ui/icon-symbol";
import { AppColors } from "@/constants/theme";
import { telemetryDB, TelemetryLog } from "@/lib/db";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface TimeWindow {
  label: string;
  seconds: number;
}

const TIME_WINDOWS: TimeWindow[] = [
  { label: "Last 5 minutes", seconds: 300 },
  { label: "Last 30 minutes", seconds: 1800 },
  { label: "Last 2 hours", seconds: 7200 },
  { label: "Last 24 hours", seconds: 86400 },
];

export default function TelemetryHistoryScreen() {
  const insets = useSafeAreaInsets();
  const [telemetryData, setTelemetryData] = useState<TelemetryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTimeWindow, setSelectedTimeWindow] = useState<TimeWindow>(TIME_WINDOWS[0]);

  const loadTelemetryData = useCallback(async () => {
    try {
      await telemetryDB.init();
      
      const data = await telemetryDB.getTelemetrySince(selectedTimeWindow.seconds);
      setTelemetryData(data);
    } catch (error) {
      console.error("Failed to load telemetry data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedTimeWindow.seconds]);

  useEffect(() => {
    loadTelemetryData();
  }, [selectedTimeWindow, loadTelemetryData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadTelemetryData();
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return {
      date: date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      }),
      time: date.toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      })
    };
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

  const handleTimeWindowChange = (timeWindow: TimeWindow) => {
    setSelectedTimeWindow(timeWindow);
    setLoading(true);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={AppColors.primary} />
        <Text style={styles.loadingText}>Loading telemetry history...</Text>
      </View>
    );
  }

  if (telemetryData.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <IconSymbol size={64} name="chart.bar" color={AppColors.gray400} />
        <Text style={styles.emptyTitle}>No Telemetry Data</Text>
        <Text style={styles.emptySubtitle}>
          Start the telemetry stream to see hardware monitoring data
        </Text>
      </View>
    );
  }

  // Group telemetry data by date
  const groupTelemetryByDate = (data: TelemetryLog[]) => {
    const groups: { [date: string]: TelemetryLog[] } = {};
    
    data.forEach(entry => {
      const { date } = formatTimestamp(entry.timestamp);
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(entry);
    });
    
    return groups;
  };

  const groupedTelemetry = groupTelemetryByDate(telemetryData);
  const sortedDates = Object.keys(groupedTelemetry).sort((a, b) => 
    new Date(b).getTime() - new Date(a).getTime()
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingTop: insets.top / 2 },
        ]}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            progressBackgroundColor={AppColors.white}
            progressViewOffset={0}
          />
        }
      >
        <Text style={styles.title}>Telemetry History</Text>

        {/* Time Window Selector */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.timeWindowContainer}
          contentContainerStyle={styles.timeWindowContent}
        >
          {TIME_WINDOWS.map((timeWindow) => (
            <TouchableOpacity
              key={timeWindow.label}
              style={[
                styles.timeWindowButton,
                selectedTimeWindow.label === timeWindow.label && styles.timeWindowButtonActive
              ]}
              onPress={() => handleTimeWindowChange(timeWindow)}
            >
              <Text style={[
                styles.timeWindowText,
                selectedTimeWindow.label === timeWindow.label && styles.timeWindowTextActive
              ]}>
                {timeWindow.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Telemetry Data */}
        {sortedDates.map((date) => {
          const dayEntries = groupedTelemetry[date].sort((a, b) => b.timestamp - a.timestamp);

          return (
            <View key={date} style={styles.dayGroup}>
              <Text style={styles.dateHeader}>
                {date} ({dayEntries.length} entries)
              </Text>

              {dayEntries.map((entry, index) => {
                const { time } = formatTimestamp(entry.timestamp);
                const gpuColor = getTemperatureColor(entry.gpu_temp);
                const cpuColor = getTemperatureColor(entry.cpu_temp);

                return (
                  <View key={`${entry.timestamp}-${index}`} style={styles.entryCardContainer}>
                    <TouchableOpacity style={styles.entryCard}>
                      <View style={styles.entryHeader}>
                        <Text style={styles.entryTime}>{time}</Text>
                        <View style={styles.entryActions}>
                          <Text style={[styles.powerText, { color: AppColors.yellow600 }]}>
                            {entry.power_draw}W
                          </Text>
                        </View>
                      </View>

                      <View style={styles.telemetryRow}>
                        {/* GPU */}
                        <View style={styles.telemetryItem}>
                          <View style={styles.telemetryHeader}>
                            <IconSymbol size={16} name="cpu" color={gpuColor} />
                            <Text style={[styles.telemetryLabel, { color: gpuColor }]}>
                              GPU
                            </Text>
                          </View>
                          <Text style={[styles.telemetryValue, { color: gpuColor }]}>
                            {entry.gpu_temp}°C
                          </Text>
                          <Text style={styles.telemetryStatus}>
                            {getTemperatureStatus(entry.gpu_temp)}
                          </Text>
                        </View>

                        {/* CPU */}
                        <View style={styles.telemetryItem}>
                          <View style={styles.telemetryHeader}>
                            <IconSymbol size={16} name="cpu" color={cpuColor} />
                            <Text style={[styles.telemetryLabel, { color: cpuColor }]}>
                              CPU
                            </Text>
                          </View>
                          <Text style={[styles.telemetryValue, { color: cpuColor }]}>
                            {entry.cpu_temp}°C
                          </Text>
                          <Text style={styles.telemetryStatus}>
                            {getTemperatureStatus(entry.cpu_temp)}
                          </Text>
                        </View>

                        {/* Fan */}
                        <View style={styles.telemetryItem}>
                          <View style={styles.telemetryHeader}>
                            <IconSymbol size={16} name="fan" color={AppColors.blue500} />
                            <Text style={[styles.telemetryLabel, { color: AppColors.blue500 }]}>
                              FAN
                            </Text>
                          </View>
                          <Text style={[styles.telemetryValue, { color: AppColors.blue500 }]}>
                            {entry.fan_rpm}
                          </Text>
                          <Text style={styles.telemetryStatus}>
                            RPM
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingBottom: 100,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0f172a",
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#f8fafc",
    marginBottom: 24,
    letterSpacing: -0.5,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: "#94a3b8",
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "600",
    color: "#f8fafc",
    textAlign: "center",
    marginBottom: 8,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 15,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 24,
  },
  timeWindowContainer: {
    marginBottom: 24,
  },
  timeWindowContent: {
    paddingRight: 24,
  },
  timeWindowButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#334155",
    marginRight: 12,
  },
  timeWindowButtonActive: {
    backgroundColor: "#6366f1",
  },
  timeWindowText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#cbd5e1",
  },
  timeWindowTextActive: {
    color: "#ffffff",
  },
  dayGroup: {
    marginBottom: 24,
  },
  dateHeader: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94a3b8",
    marginBottom: 24,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  entryCardContainer: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  entryCard: {
    backgroundColor: "transparent",
  },
  entryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  entryTime: {
    fontSize: 16,
    fontWeight: "600",
    color: AppColors.gray800,
  },
  entryActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  powerText: {
    fontSize: 14,
    fontWeight: "600",
  },
  telemetryRow: {
    justifyContent: "space-between",
  },
  telemetryItem: {
    alignItems: "center",
  },
  telemetryHeader: {
    alignItems: "center",
    marginBottom: 4,
  },
  telemetryLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },
  telemetryValue: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 2,
  },
  telemetryStatus: {
    fontSize: 10,
    color: AppColors.gray500,
    fontWeight: "500",
  },
});