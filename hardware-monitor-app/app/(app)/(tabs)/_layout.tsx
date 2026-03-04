import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Tabs, useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

// Custom monitor button component
function MonitorButton() {
  const router = useRouter();

  return (
    <View style={styles.monitorButton}>
      <Pressable
        onPress={() => router.push("/live-monitor")}
        style={({ pressed }) => [
          { opacity: pressed ? 0.8 : 1 },
          styles.monitorButtonInner,
        ]}
      >
        <IconSymbol size={24} name="chart.bar.fill" color="white" />
      </Pressable>
    </View>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: "#1e293b",
          borderTopWidth: 1,
          borderTopColor: "#334155",
          height: 90,
          paddingBottom: 20,
          paddingTop: 10,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="chart.bar.fill" color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="entries"
        options={{
          title: "History",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="clock.fill" color={color} />
          ),
        }}
      />

      {/* Center Monitor Button */}
      <Tabs.Screen
        name="live-monitor"
        options={{
          title: "",
          tabBarIcon: () => <MonitorButton />,
          tabBarButton: () => <MonitorButton />,
        }}
      />

      <Tabs.Screen
        name="ai-chat"
        options={{
          title: "Chat",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="brain.head.profile" color={color} />
          ),
        }}
      />

          <Tabs.Screen
            name="mcp-analytics"
            options={{
              title: "Analytics",
              tabBarIcon: ({ color }) => (
                <IconSymbol size={28} name="chart.line.uptrend.xyaxis" color={color} />
              ),
            }}
          />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="person.fill" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  monitorButton: {
    backgroundColor: "#904BFF",
    position: "absolute",
    top: -20,
    borderRadius: 30,
    width: 60,
    height: 60,
    alignSelf: "center",
    shadowColor: "#904BFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  monitorButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
  },
});
