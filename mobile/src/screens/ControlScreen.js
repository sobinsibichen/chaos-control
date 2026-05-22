import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors, radius, spacing } from "@/theme/tokens";

export function ControlScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Control</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Auto-block schedule</Text>
        <Text style={styles.cardText}>Prepared for native schedule and app-picker wiring.</Text>
        <Pressable style={styles.button}>
          <Text style={styles.buttonText}>Choose Apps</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, padding: spacing.xl },
  title: { fontSize: 30, fontWeight: "700", color: colors.text, marginBottom: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: 12 },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: "700" },
  cardText: { color: colors.muted },
  button: { backgroundColor: colors.primary, padding: 14, borderRadius: radius.pill, alignItems: "center", marginTop: 8 },
  buttonText: { color: colors.primaryText, fontWeight: "700" },
});
