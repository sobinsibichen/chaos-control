import React from "react";
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { useAppStore } from "@/store/appStore";
import { colors, radius, spacing } from "@/theme/tokens";

export function LoginScreen() {
  const login = useAppStore((state) => state.login);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.root}>
      <View style={styles.content}>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to continue managing your chaos.</Text>
        <TextInput placeholder="Email" placeholderTextColor={colors.muted} style={styles.input} />
        <TextInput placeholder="Password" placeholderTextColor={colors.muted} secureTextEntry style={styles.input} />
        <Pressable onPress={() => login({ username: "Vanessa", email: "hello@lastpuff.app", rememberMe: true })} style={styles.button}>
          <Text style={styles.buttonText}>Login</Text>
        </Pressable>
        <Pressable style={styles.secondary}>
          <Text style={styles.secondaryText}>Go to Signup</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, justifyContent: "center" },
  content: { padding: spacing.xl, gap: spacing.md },
  title: { fontSize: 32, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 14, color: colors.muted, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.text,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  buttonText: { color: colors.primaryText, fontWeight: "700" },
  secondary: { alignItems: "center", paddingVertical: 12 },
  secondaryText: { color: colors.text, fontWeight: "600" },
});
