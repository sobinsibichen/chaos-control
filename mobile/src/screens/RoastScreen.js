import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, radius, spacing } from "@/theme/tokens";

export function RoastScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Roast</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Analytics</Text>
        <Text style={styles.cardText}>Monthly burn graph and regret metrics will map here in native charts.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, padding: spacing.xl },
  title: { fontSize: 30, fontWeight: "700", color: colors.text, marginBottom: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: "700" },
  cardText: { color: colors.muted, marginTop: 8 },
});
