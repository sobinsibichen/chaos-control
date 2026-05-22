import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing } from "@/theme/tokens";

export function VerificationScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Verification</Text>
      <Text style={styles.subtitle}>Placeholder for future challenge and unlock flow.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, padding: spacing.xl },
  title: { color: colors.text, fontSize: 28, fontWeight: "700" },
  subtitle: { color: colors.muted, marginTop: 8 },
});
