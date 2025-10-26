import Logo from "@/components/Logo";
import { useModal } from "@/contexts/ModalContext";
import { useSignUp } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import * as React from "react";
import { SafeAreaView, ScrollView, TextInput, Text, TouchableOpacity, View, StyleSheet } from "react-native";

export default function SignUpScreen() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const router = useRouter();
  const { showModal } = useModal();

  const [emailAddress, setEmailAddress] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [pendingVerification, setPendingVerification] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);

  // Start the sign up process using the email and password provided
  const onSignUpPress = async () => {
    if (!isLoaded) return;
    setIsLoading(true);

    try {
      // Create the user on Clerk
      await signUp.create({
        emailAddress,
        password,
      });

      // Send the email.
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });

      // Change the UI to our pending section.
      setPendingVerification(true);
    } catch (err: any) {
      showModal({
        type: "dialog",
        title: "Error",
        description: err?.errors?.[0]?.longMessage || "An error occurred during sign up",
        onCancel: () => {
          setIsLoading(false);
        },
      });
    } finally {
      setIsLoading(false);
    }
  };

  // This verifies the user using email code that is delivered.
  const onPressVerify = async () => {
    if (!isLoaded) return;
    setIsLoading(true);

    try {
      const completeSignUp = await signUp.attemptEmailAddressVerification({
        code,
      });

      if (completeSignUp.status === "complete") {
        await setActive({ session: completeSignUp.createdSessionId });
        router.replace("/");
      } else {
        // Investigate the response, to see if there was an error
        console.error(JSON.stringify(completeSignUp, null, 2));
      }
    } catch (err: any) {
      showModal({
        type: "dialog",
        title: "Error",
        description: err?.errors?.[0]?.longMessage || "An error occurred during verification",
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
              Sign up to Hardware Monitor to continue
            </Text>
          </View>

          {!pendingVerification && (
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
                  onPress={onSignUpPress}
                  disabled={!isLoaded || isLoading}
                >
                  <Text style={styles.buttonText}>
                    {isLoading ? "Signing up..." : "Sign Up"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {pendingVerification && (
            <View style={styles.card}>
              <View style={styles.form}>
                <Text style={styles.verificationTitle}>Verify your email</Text>
                <Text style={styles.verificationSubtitle}>
                  Please enter the verification code sent to your email
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Verification Code</Text>
                  <TextInput
                    style={styles.input}
                    value={code}
                    placeholder="Enter verification code"
                    onChangeText={setCode}
                  />
                </View>

                <TouchableOpacity
                  style={[
                    styles.button,
                    (!isLoaded || isLoading) && styles.buttonDisabled
                  ]}
                  onPress={onPressVerify}
                  disabled={!isLoaded || isLoading}
                >
                  <Text style={styles.buttonText}>
                    {isLoading ? "Verifying..." : "Verify Email"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => router.push("/sign-in")}
            >
              <Text style={styles.linkText}>Sign In</Text>
            </TouchableOpacity>
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
  verificationTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#000",
    textAlign: "center",
    marginBottom: 8,
  },
  verificationSubtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 16,
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