import { HardwareProvider } from "@/contexts/HardwareContext";
import { ModalProvider } from "@/contexts/ModalContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
// import "@/polyfills"; // Temporarily disabled
import { ClerkProvider } from "@clerk/clerk-expo";
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Slot } from "expo-router";
import "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <SafeAreaProvider>
      <ClerkProvider tokenCache={tokenCache}>
        <HardwareProvider>
          <ModalProvider>
            <ThemeProvider
              value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
            >
              <Slot />
            </ThemeProvider>
          </ModalProvider>
        </HardwareProvider>
      </ClerkProvider>
    </SafeAreaProvider>
  );
}
