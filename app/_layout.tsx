import { ModalProvider } from "@/contexts/ModalContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { telemetryDB } from "@/lib/db";
import "@/polyfills";
import { ClerkProvider } from "@clerk/clerk-expo";
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Slot } from "expo-router";
import { useEffect } from "react";
import "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    // Initialize telemetry database when app starts
    telemetryDB.init().catch(console.error);
    
    // Cleanup on unmount
    return () => {
      telemetryDB.destroy();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <ClerkProvider tokenCache={tokenCache}>
        <ModalProvider>
          <ThemeProvider
            value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
          >
            <Slot />
          </ThemeProvider>
        </ModalProvider>
      </ClerkProvider>
    </SafeAreaProvider>
  );
}
