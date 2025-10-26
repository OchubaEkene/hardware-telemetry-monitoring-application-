import { Feather } from "@expo/vector-icons";
import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function Logo({ hasText = false }: { hasText?: boolean }) {
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Feather name="monitor" size={32} color="white" />
      </View>
      {hasText && (
        <Text style={styles.text}>
          Hardware Monitor
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  iconContainer: {
    backgroundColor: "#904BFF",
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
  },
  text: {
    fontSize: 28,
    fontWeight: "700",
    color: "#000",
  },
});
