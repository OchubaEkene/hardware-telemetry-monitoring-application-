import Logo from "@/components/Logo";
import SignInWithGoogle from "@/components/SignInWithGoogle";
import { useModal } from "@/contexts/ModalContext";
import { isClerkAPIResponseError, useSignIn } from "@clerk/clerk-expo";
import { ClerkAPIResponseError } from "@clerk/types";
import { Link, useRouter } from "expo-router";
import React, { useState } from "react";
import { SafeAreaView, ScrollView, TextInput, Text, TouchableOpacity, View, StyleSheet } from "react-native";

export default function Page() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();

  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { showModal } = useModal();

  // Handle the submission of the sign-in form
  const onSignInPress = async () => {
    if (!isLoaded) return;
    setIsLoading(true);

    // Start the sign-in process using the email and password provided
    try {
      const signInAttempt = await signIn.create({
        identifier: emailAddress,
        password,
      });

      // If sign-in process is complete, set the created session as active
      // and redirect the user
      if (signInAttempt.status === "complete") {
        await setActive({ session: signInAttempt.createdSessionId });
        router.replace("/");
      } else {
        // If the status isn't complete, check why. User might need to
        // complete further steps.
        console.error(JSON.stringify(signInAttempt, null, 2));
      }
    } catch (err) {
      // See https://clerk.com/docs/custom-flows/error-handling
      // for more info on error handling

      const clerkError = isClerkAPIResponseError(err)
        ? (err as ClerkAPIResponseError)
        : null;

      showModal({
        type: "dialog",
        title: "Error",
        description:
          clerkError?.errors[0]?.longMessage ||
          clerkError?.errors[0]?.message ||
          "Whoops an error occurred, please try again!",
        onCancel: () => {
          setIsLoading(false);
        },
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Logo />

          <View style={styles.header}>
            <Text style={styles.title}>Welcome</Text>
            <Text style={styles.subtitle}>
              Sign in to Hardware Monitor to continue
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email Address</Text>
                <TextInput
                  style={styles.input}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={emailAddress}
                  placeholder="Enter your email"
                  onChangeText={setEmailAddress}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={styles.input}
                  secureTextEntry
                  value={password}
                  placeholder="Enter your password"
                  onChangeText={setPassword}
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.button,
                  (!isLoaded || isLoading) && styles.buttonDisabled
                ]}
                onPress={onSignInPress}
                disabled={!isLoaded || isLoading}
              >
                <Text style={styles.buttonText}>
                  {isLoading ? "Signing in..." : "Sign In"}
                </Text>
              </TouchableOpacity>

              <SignInWithGoogle />
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don&apos;t have an account?</Text>
            <Link href="/sign-up" asChild>
              <TouchableOpacity style={styles.linkButton}>
                <Text style={styles.linkText}>Sign Up</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  scrollContent: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
    justifyContent: "center",
    minHeight: "100%",
  },
  header: {
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
    color: "#000",
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    color: "#666",
    marginTop: 8,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#904BFF",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  footerText: {
    color: "#666",
  },
  linkButton: {
    borderWidth: 1,
    borderColor: "#904BFF",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  linkText: {
    color: "#904BFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
