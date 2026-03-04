import { SignOutButton } from "@/components/SignOutButton";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { AppColors } from "@/constants/theme";
import { useHardware } from "@/contexts/HardwareContext";
import { getUserDisplayName, getUserInitials } from "@/lib/utils/user";
import { Protect, useUser } from "@clerk/clerk-expo";
import { Image, Linking, Modal, StyleSheet, View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Share, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { telemetryDB } from "@/lib/db";
import { useState, useEffect } from "react";
import * as SecureStore from "expo-secure-store";

const INSIGHTS_URL_KEY = "insights_service_url";

export default function Profile() {
  const { user, isLoaded } = useUser();
  const insets = useSafeAreaInsets();
  const { connectionStatus, agentHost, saveAndConnect, disconnect } = useHardware();
  const [hardwareStats, setHardwareStats] = useState<any>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [agentModalVisible, setAgentModalVisible] = useState(false);
  const [ipInput, setIpInput] = useState('');
  const [insightsModalVisible, setInsightsModalVisible] = useState(false);
  const [insightsUrl, setInsightsUrl] = useState<string | null>(null);
  const [insightsUrlInput, setInsightsUrlInput] = useState('');

  // Load insights URL from SecureStore
  useEffect(() => {
    SecureStore.getItemAsync(INSIGHTS_URL_KEY).then((val) => {
      if (val) setInsightsUrl(val);
    });
  }, []);

  // Load hardware stats
  useEffect(() => {
    const loadHardwareStats = async () => {
      try {
        const stats = await telemetryDB.getTelemetryStats(3600); // Last hour
        const anomalies = await telemetryDB.detectAnomalies(3600);
        const latest = await telemetryDB.getLatestTelemetry(1);

        setHardwareStats({
          stats,
          anomalies,
          latest: latest[0] || null,
          totalLogs: await telemetryDB.getTelemetrySince(86400).then(data => data.length) // Last 24h
        });
      } catch (error) {
        console.error('Error loading hardware stats:', error);
      } finally {
        setIsLoadingStats(false);
      }
    };

    loadHardwareStats();
  }, []);

  if (!isLoaded) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </View>
    );
  }

  const initials = getUserInitials(user);
  const displayName = getUserDisplayName(user);

  const statusColors: Record<string, string> = {
    connected: '#10b981',
    connecting: '#f59e0b',
    error: '#ef4444',
    disconnected: '#64748b',
  };
  const statusDotColor = statusColors[connectionStatus] ?? '#64748b';

  const handleRefreshData = async () => {
    try {
      setIsLoadingStats(true);
      const stats = await telemetryDB.getTelemetryStats(3600);
      const anomalies = await telemetryDB.detectAnomalies(3600);
      const latest = await telemetryDB.getLatestTelemetry(1);

      setHardwareStats({
        stats,
        anomalies,
        latest: latest[0] || null,
        totalLogs: await telemetryDB.getTelemetrySince(86400).then(data => data.length)
      });

      Alert.alert("Success", "Hardware data refreshed successfully!");
    } catch (error) {
      Alert.alert("Error", "Failed to refresh data. Please try again.");
    } finally {
      setIsLoadingStats(false);
    }
  };

  const handleExportLogs = async () => {
    try {
      const logs = await telemetryDB.getTelemetrySince(86400); // Last 24 hours
      const csvData = logs.map(log =>
        `${new Date(log.timestamp * 1000).toISOString()},${log.gpu_temp},${log.cpu_temp},${log.fan_rpm},${log.power_draw}`
      ).join('\n');

      const csvContent = `Timestamp,GPU Temp (°C),CPU Temp (°C),Fan RPM,Power Draw (W)\n${csvData}`;

      await Share.share({
        message: csvContent,
        title: 'Hardware Telemetry Logs',
      });
    } catch (error) {
      Alert.alert("Error", "Failed to export logs. Please try again.");
    }
  };

  const handleAlertSettings = () => {
    Alert.alert(
      "Alert Settings",
      "Configure temperature and performance alerts:\n\n• GPU Temperature: Alert when > 80°C\n• CPU Temperature: Alert when > 80°C\n• Power Draw: Alert when > 200W\n• Fan Speed: Alert when < 1000 RPM",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Configure", onPress: () => Alert.alert("Coming Soon", "Alert configuration will be available in a future update.") }
      ]
    );
  };

  const handleGeneralSettings = () => {
    Alert.alert(
      "General Settings",
      "Configure your hardware monitoring preferences:\n\n• Data Collection Interval\n• Display Units (°C/°F)\n• Theme Preferences\n• Auto-refresh Settings",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Open Settings", onPress: () => Alert.alert("Coming Soon", "Settings panel will be available in a future update.") }
      ]
    );
  };

  const handlePrivacySecurity = () => {
    Alert.alert(
      "Privacy & Security",
      "Your data privacy and security:\n\n• All telemetry data is stored locally\n• No data is sent to external servers\n• You can export or delete your data anytime\n• Secure authentication with Clerk",
      [
        { text: "OK", style: "default" }
      ]
    );
  };

  const handleHelpSupport = () => {
    Alert.alert(
      "Help & Support",
      "Get help with Hardware Monitor:\n\n• Check the Analytics tab for detailed insights\n• Use the Chat tab for AI-powered analysis\n• Export logs for troubleshooting\n• Contact support for advanced issues",
      [
        { text: "OK", style: "default" }
      ]
    );
  };

  const handleAgentConnect = async () => {
    const host = ipInput.trim();
    if (!host) return;
    setAgentModalVisible(false);
    await saveAndConnect(host);
    setIpInput('');
  };

  const handleAgentDisconnect = () => {
    setAgentModalVisible(false);
    disconnect();
  };

  const handleSaveInsightsUrl = async () => {
    const url = insightsUrlInput.trim();
    if (url) {
      await SecureStore.setItemAsync(INSIGHTS_URL_KEY, url);
      setInsightsUrl(url);
    } else {
      await SecureStore.deleteItemAsync(INSIGHTS_URL_KEY);
      setInsightsUrl(null);
    }
    setInsightsModalVisible(false);
    setInsightsUrlInput('');
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{
          paddingTop: insets.top + 20,
        }}
      >
        <View style={[styles.content, { paddingBottom: insets.bottom + 100 }]}>
          {/* Profile Header Card */}
          <View style={styles.profileCard}>
            <View style={styles.profileContent}>
              {/* Profile Picture */}
              <View style={styles.profilePicture}>
                {user?.imageUrl ? (
                  <Image
                    source={{ uri: user.imageUrl }}
                    style={styles.profileImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.profileInitials}>
                    <Text style={styles.initialsText}>{initials}</Text>
                  </View>
                )}
              </View>

              {/* User Info */}
              <View style={styles.userInfo}>
                <Text style={styles.displayName}>{displayName}</Text>
                <Text style={styles.email}>{user?.emailAddresses[0]?.emailAddress}</Text>
                <View style={styles.statusBadge}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>Hardware Monitor Active</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Hardware Overview Cards */}
          <View style={styles.statsContainer}>
            <Text style={styles.sectionTitle}>Hardware Overview</Text>

            {/* System Health Card */}
            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <MaterialIcons name="health-and-safety" size={24} color="#10b981" />
              </View>
              <View style={styles.statContent}>
                <Text style={styles.statTitle}>System Health</Text>
                {isLoadingStats ? (
                  <ActivityIndicator size="small" color="#6366f1" />
                ) : (
                  <>
                    <Text style={styles.statValue}>
                      {hardwareStats?.latest ?
                        (hardwareStats.latest.gpu_temp < 70 && hardwareStats.latest.cpu_temp < 70 ? 'Excellent' : 'Good')
                        : 'Unknown'
                      }
                    </Text>
                    <Text style={styles.statSubtitle}>
                      {hardwareStats?.latest ?
                        `GPU: ${hardwareStats.latest.gpu_temp.toFixed(1)}°C, CPU: ${hardwareStats.latest.cpu_temp.toFixed(1)}°C`
                        : 'Loading...'
                      }
                    </Text>
                  </>
                )}
              </View>
            </View>

            {/* Performance Card */}
            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <MaterialIcons name="speed" size={24} color="#6366f1" />
              </View>
              <View style={styles.statContent}>
                <Text style={styles.statTitle}>Performance</Text>
                {isLoadingStats ? (
                  <ActivityIndicator size="small" color="#6366f1" />
                ) : (
                  <>
                    <Text style={styles.statValue}>
                      {hardwareStats?.latest ?
                        `${hardwareStats.latest.fan_rpm.toFixed(0)} RPM`
                        : 'Unknown'
                      }
                    </Text>
                    <Text style={styles.statSubtitle}>
                      {hardwareStats?.latest ?
                        `Power: ${hardwareStats.latest.power_draw.toFixed(1)}W`
                        : 'Loading...'
                      }
                    </Text>
                  </>
                )}
              </View>
            </View>

            {/* Monitoring Stats Card */}
            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <MaterialIcons name="analytics" size={24} color="#f59e0b" />
              </View>
              <View style={styles.statContent}>
                <Text style={styles.statTitle}>Monitoring</Text>
                {isLoadingStats ? (
                  <ActivityIndicator size="small" color="#6366f1" />
                ) : (
                  <>
                    <Text style={styles.statValue}>
                      {hardwareStats?.totalLogs || 0} Logs
                    </Text>
                    <Text style={styles.statSubtitle}>
                      {hardwareStats?.anomalies ?
                        `${hardwareStats.anomalies.gpuAnomalies.length + hardwareStats.anomalies.cpuAnomalies.length + hardwareStats.anomalies.powerAnomalies.length} Anomalies Detected`
                        : 'Last 24 hours'
                      }
                    </Text>
                  </>
                )}
              </View>
            </View>
          </View>

          {/* Quick Actions */}
          <View style={styles.actionsContainer}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>

            <TouchableOpacity style={styles.actionButton} onPress={handleRefreshData}>
              <View style={styles.actionContent}>
                <MaterialIcons name="refresh" size={20} color="#6366f1" />
                <Text style={styles.actionText}>Refresh Data</Text>
              </View>
              <MaterialIcons name="chevron-right" size={16} color="#9ca3af" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleExportLogs}>
              <View style={styles.actionContent}>
                <MaterialIcons name="download" size={20} color="#10b981" />
                <Text style={styles.actionText}>Export Logs</Text>
              </View>
              <MaterialIcons name="chevron-right" size={16} color="#9ca3af" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleAlertSettings}>
              <View style={styles.actionContent}>
                <MaterialIcons name="notifications" size={20} color="#f59e0b" />
                <Text style={styles.actionText}>Alert Settings</Text>
              </View>
              <MaterialIcons name="chevron-right" size={16} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          {/* Settings Section */}
          <View style={styles.settingsContainer}>
            <Text style={styles.sectionTitle}>Settings</Text>

            {/* Hardware Agent Row */}
            <TouchableOpacity
              style={styles.settingItem}
              onPress={() => {
                setIpInput(agentHost ?? '');
                setAgentModalVisible(true);
              }}
            >
              <View style={styles.settingContent}>
                <View style={[styles.agentDot, { backgroundColor: statusDotColor }]} />
                <Text style={styles.settingText}>
                  Hardware Agent{agentHost ? `: ${agentHost}` : ''}
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={16} color="#9ca3af" />
            </TouchableOpacity>

            {/* AI Insights Service Row */}
            <TouchableOpacity
              style={styles.settingItem}
              onPress={() => {
                setInsightsUrlInput(insightsUrl ?? '');
                setInsightsModalVisible(true);
              }}
            >
              <View style={styles.settingContent}>
                <MaterialIcons name="psychology" size={20} color="#6366f1" />
                <Text style={styles.settingText}>
                  AI Insights Service{insightsUrl ? `: ${insightsUrl}` : ''}
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={16} color="#9ca3af" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingItem}
              onPress={handleGeneralSettings}
            >
              <View style={styles.settingContent}>
                <MaterialIcons name="settings" size={20} color="#6b7280" />
                <Text style={styles.settingText}>General Settings</Text>
              </View>
              <MaterialIcons name="chevron-right" size={16} color="#9ca3af" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingItem}
              onPress={handlePrivacySecurity}
            >
              <View style={styles.settingContent}>
                <MaterialIcons name="security" size={20} color="#6b7280" />
                <Text style={styles.settingText}>Privacy & Security</Text>
              </View>
              <MaterialIcons name="chevron-right" size={16} color="#9ca3af" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingItem}
              onPress={handleHelpSupport}
            >
              <View style={styles.settingContent}>
                <MaterialIcons name="help" size={20} color="#6b7280" />
                <Text style={styles.settingText}>Help & Support</Text>
              </View>
              <MaterialIcons name="chevron-right" size={16} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          {/* Sign Out Button */}
          <View style={styles.signOutContainer}>
            <SignOutButton />
          </View>
        </View>
      </ScrollView>

      {/* AI Insights Service Modal */}
      <Modal
        visible={insightsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setInsightsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>AI Insights Service</Text>
            <Text style={styles.modalSubtitle}>
              Enter the URL of your Claude-powered insights service (e.g. http://192.168.1.100:8080)
            </Text>
            <TextInput
              style={styles.modalInput}
              value={insightsUrlInput}
              onChangeText={setInsightsUrlInput}
              placeholder="http://192.168.1.100:8080"
              placeholderTextColor="#64748b"
              autoCapitalize="none"
              keyboardType="url"
            />
            <TouchableOpacity style={styles.modalConnect} onPress={handleSaveInsightsUrl}>
              <Text style={styles.modalConnectText}>Save</Text>
            </TouchableOpacity>
            {insightsUrl && (
              <TouchableOpacity
                style={styles.modalDisconnect}
                onPress={async () => {
                  await SecureStore.deleteItemAsync(INSIGHTS_URL_KEY);
                  setInsightsUrl(null);
                  setInsightsModalVisible(false);
                }}
              >
                <Text style={styles.modalDisconnectText}>Clear URL</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setInsightsModalVisible(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Hardware Agent Modal */}
      <Modal
        visible={agentModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAgentModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Hardware Agent</Text>
            <Text style={styles.modalSubtitle}>
              Enter the IP address of the PC running agent.py
            </Text>
            <TextInput
              style={styles.modalInput}
              value={ipInput}
              onChangeText={setIpInput}
              placeholder="192.168.1.100"
              placeholderTextColor="#64748b"
              keyboardType="numeric"
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.modalConnect} onPress={handleAgentConnect}>
              <Text style={styles.modalConnectText}>Connect</Text>
            </TouchableOpacity>
            {connectionStatus !== 'disconnected' && (
              <TouchableOpacity style={styles.modalDisconnect} onPress={handleAgentDisconnect}>
                <Text style={styles.modalDisconnectText}>Disconnect</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setAgentModalVisible(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: "#94a3b8",
    fontWeight: "500",
  },
  content: {
    paddingHorizontal: 16,
    gap: 20,
  },
  profileCard: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#334155",
  },
  profileContent: {
    alignItems: "center",
    gap: 16,
  },
  profilePicture: {
    borderRadius: 60,
    overflow: "hidden",
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#334155",
    borderWidth: 3,
    borderColor: "#6366f1",
  },
  profileImage: {
    width: 120,
    height: 120,
  },
  profileInitials: {
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#6366f1",
  },
  initialsText: {
    fontSize: 36,
    fontWeight: "700",
    color: "white",
  },
  userInfo: {
    alignItems: "center",
    gap: 8,
  },
  displayName: {
    fontSize: 24,
    fontWeight: "700",
    color: "#f8fafc",
  },
  email: {
    fontSize: 16,
    color: "#94a3b8",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10b981",
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: "#10b981",
    fontWeight: "600",
  },
  statsContainer: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#f8fafc",
    marginBottom: 12,
  },
  statCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#334155",
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(99, 102, 241, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.3)",
  },
  statContent: {
    flex: 1,
  },
  statTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#cbd5e1",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f8fafc",
    marginBottom: 2,
  },
  statSubtitle: {
    fontSize: 14,
    color: "#94a3b8",
  },
  actionsContainer: {
    gap: 8,
  },
  actionButton: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#334155",
  },
  actionContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  actionText: {
    fontSize: 16,
    color: "#f8fafc",
    fontWeight: "500",
  },
  settingsContainer: {
    gap: 8,
  },
  settingItem: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#334155",
  },
  settingContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  settingText: {
    fontSize: 16,
    color: "#f8fafc",
    fontWeight: "500",
  },
  agentDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  signOutContainer: {
    marginTop: 8,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: '#334155',
    gap: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f8fafc',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
  },
  modalInput: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: '#f8fafc',
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalConnect: {
    backgroundColor: '#6366f1',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  modalConnectText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 16,
  },
  modalDisconnect: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  modalDisconnectText: {
    color: '#ef4444',
    fontWeight: '700',
    fontSize: 16,
  },
  modalCancel: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 14,
    paddingVertical: 4,
  },
});
