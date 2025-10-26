import Logo from "@/components/Logo";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { AppColors } from "@/constants/theme";
import { formatUppercaseDate, getTimeOfDayGreeting } from "@/lib/utils/date";
import { getUserFirstName } from "@/lib/utils/user";
import { telemetryDB, TelemetryLog } from "@/lib/db";
import { useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { 
  Pressable, 
  StyleSheet, 
  RefreshControl, 
  ScrollView, 
  View, 
  Text, 
  ActivityIndicator 
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

interface TelemetryStats {
  avgGpuTemp: number;
  avgCpuTemp: number;
  latestFanRpm: number;
  powerTrend: 'up' | 'down' | 'stable';
}

export default function DashboardScreen() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<TelemetryStats | null>(null);
  const [latestTelemetry, setLatestTelemetry] = useState<TelemetryLog | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Format current date and get greeting using utilities
  const now = new Date();
  const formattedDate = formatUppercaseDate(now);
  const greeting = getTimeOfDayGreeting();
  const userName = getUserFirstName(user);

  const loadTelemetryData = async () => {
    try {
      await telemetryDB.init();
      
      // Get stats for last 10 minutes
      const telemetryStats = await telemetryDB.getTelemetryStats(600);
      setStats(telemetryStats);
      
      // Get latest telemetry
      const latest = await telemetryDB.getLatestTelemetry(1);
      if (latest.length > 0) {
        setLatestTelemetry(latest[0]);
      }
    } catch (error) {
      console.error('Error loading telemetry data:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadTelemetryData();
    
    // Refresh data every 5 seconds
    const interval = setInterval(loadTelemetryData, 5000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadTelemetryData();
  };

  if (!isLoaded || isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#904BFF" />
          <Text style={styles.loadingText}>Loading telemetry data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const getTemperatureColor = (temp: number) => {
    if (temp < 50) return AppColors.green500;
    if (temp < 70) return AppColors.yellow500;
    return AppColors.red500;
  };

  const getPowerTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return 'arrow.up.circle.fill';
      case 'down': return 'arrow.down.circle.fill';
      default: return 'minus.circle.fill';
    }
  };

  const getPowerTrendColor = (trend: string) => {
    switch (trend) {
      case 'up': return AppColors.red500;
      case 'down': return AppColors.green500;
      default: return AppColors.gray500;
    }
  };

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
        {/* Header with date */}
        <View style={styles.header}>
          <Logo />
          <Text style={styles.dateText}>
            {formattedDate}
          </Text>
        </View>

        {/* Greeting */}
        <View style={styles.greeting}>
          <Text style={styles.greetingTitle}>
            {greeting}, {userName}!
          </Text>
          <Text style={styles.greetingSubtitle}>
            Hardware Telemetry Dashboard
          </Text>
        </View>

        {/* Current Status Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>CURRENT STATUS</Text>
            
            {latestTelemetry && (
              <View style={styles.statsRow}>
                {/* GPU Temperature */}
                <View style={styles.statItem}>
                  <IconSymbol
                    size={24}
                    name="cpu"
                    color={getTemperatureColor(latestTelemetry.gpu_temp)}
                  />
                  <Text style={styles.statLabel}>GPU</Text>
                  <Text style={[styles.statValue, { color: getTemperatureColor(latestTelemetry.gpu_temp) }]}>
                    {latestTelemetry.gpu_temp}°C
                  </Text>
                </View>

                {/* CPU Temperature */}
                <View style={styles.statItem}>
                  <IconSymbol
                    size={24}
                    name="cpu"
                    color={getTemperatureColor(latestTelemetry.cpu_temp)}
                  />
                  <Text style={styles.statLabel}>CPU</Text>
                  <Text style={[styles.statValue, { color: getTemperatureColor(latestTelemetry.cpu_temp) }]}>
                    {latestTelemetry.cpu_temp}°C
                  </Text>
                </View>

                {/* Fan RPM */}
                <View style={styles.statItem}>
                  <IconSymbol
                    size={24}
                    name="fan"
                    color={AppColors.blue500}
                  />
                  <Text style={styles.statLabel}>FAN</Text>
                  <Text style={styles.statValue}>
                    {latestTelemetry.fan_rpm}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* 10-Minute Averages */}
          {stats && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>10-MINUTE AVERAGES</Text>
              
              <View style={styles.statsRow}>
                {/* Average GPU */}
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>AVG GPU</Text>
                  <Text style={[styles.statValue, { color: getTemperatureColor(stats.avgGpuTemp) }]}>
                    {stats.avgGpuTemp.toFixed(1)}°C
                  </Text>
                </View>

                {/* Average CPU */}
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>AVG CPU</Text>
                  <Text style={[styles.statValue, { color: getTemperatureColor(stats.avgCpuTemp) }]}>
                    {stats.avgCpuTemp.toFixed(1)}°C
                  </Text>
                </View>

                {/* Power Trend */}
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>POWER</Text>
                  <IconSymbol
                    size={24}
                    name={getPowerTrendIcon(stats.powerTrend)}
                    color={getPowerTrendColor(stats.powerTrend)}
                  />
                  <Text style={[styles.statValue, { color: getPowerTrendColor(stats.powerTrend) }]}>
                    {stats.powerTrend.toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {/* Live Monitor Button */}
          <Pressable
            onPress={() => router.push("/live-monitor")}
            style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
          >
            <View style={[styles.actionCard, styles.primaryCard]}>
              <View style={styles.actionContent}>
                <IconSymbol
                  size={24}
                  name="chart.bar.fill"
                  color="white"
                />
                <Text style={styles.primaryActionText}>
                  Live Monitor
                </Text>
              </View>
            </View>
          </Pressable>

          {/* View History Button */}
          <Pressable
            onPress={() => router.push("/(app)/(tabs)/entries")}
            style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
          >
            <View style={styles.actionCard}>
              <View style={styles.actionContent}>
                <IconSymbol
                  size={24}
                  name="clock.fill"
                  color={AppColors.primary}
                />
                <Text style={styles.actionText}>
                  View History
                </Text>
              </View>
            </View>
          </Pressable>

          {/* Analytics Button */}
          <Pressable
            onPress={() => router.push("/(app)/(tabs)/ai-chat")}
            style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
          >
            <View style={styles.actionCard}>
              <View style={styles.actionContent}>
                <IconSymbol
                  size={24}
                  name="brain.head.profile"
                  color={AppColors.primary}
                />
                <Text style={styles.actionText}>
                  AI Analytics
                </Text>
              </View>
            </View>
          </Pressable>
        </View>
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
    gap: 8,
  },
  dateText: {
    fontSize: 14,
    color: "#94a3b8",
    fontWeight: "500",
    textTransform: "uppercase",
  },
  greeting: {
    alignItems: "center",
    marginBottom: 16,
    gap: 8,
  },
  greetingTitle: {
    fontSize: 32,
    fontWeight: "700",
    textAlign: "center",
    color: "#f8fafc",
  },
  greetingSubtitle: {
    fontSize: 16,
    color: "#94a3b8",
    textAlign: "center",
  },
  statsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 20,
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
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statItem: {
    alignItems: "center",
    flex: 1,
    gap: 8,
  },
  statLabel: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "600",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#f8fafc",
  },
  actionButtons: {
    gap: 12,
    marginBottom: 24,
  },
  actionCard: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#334155",
  },
  primaryCard: {
    backgroundColor: "#6366f1",
    borderColor: "#6366f1",
  },
  actionContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  actionText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#f8fafc",
  },
  primaryActionText: {
    fontSize: 18,
    fontWeight: "600",
    color: "white",
  },
});