import React from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { colors, radius, spacing } from "@/theme/tokens";

export function SignupScreen() {
  return (
    <View style={styles.root}>
      <View style={styles.content}>
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Username, email, password, confirm password.</Text>
        <TextInput placeholder="Username" placeholderTextColor={colors.muted} style={styles.input} />
        <TextInput placeholder="Email" placeholderTextColor={colors.muted} style={styles.input} />
        <TextInput placeholder="Password" placeholderTextColor={colors.muted} secureTextEntry style={styles.input} />
        <TextInput placeholder="Confirm Password" placeholderTextColor={colors.muted} secureTextEntry style={styles.input} />
        <Pressable style={styles.button}>
          <Text style={styles.buttonText}>Create Account</Text>
        </Pressable>
        <Pressable style={styles.secondary}>
          <Text style={styles.secondaryText}>Go to Login</Text>
        </Pressable>
      </View>
    </View>
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
