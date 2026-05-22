import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useAppStore } from "@/store/appStore";
import { colors, radius, spacing } from "@/theme/tokens";

export function HomeScreen() {
  const stats = useAppStore((state) => state.stats);
  const recordPuff = useAppStore((state) => state.recordPuff);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Home</Text>
      <Pressable onPress={recordPuff} style={styles.button}>
        <Text style={styles.buttonText}>Record Cigarette</Text>
      </Pressable>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Today</Text>
        <Text style={styles.cardValue}>{stats.cigarettesToday}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Daily Metrics</Text>
        <Text style={styles.cardText}>Spend and analytics update from the same shared store.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, gap: spacing.md },
  title: { fontSize: 30, fontWeight: "700", color: colors.text },
  button: { backgroundColor: colors.primary, borderRadius: radius.pill, padding: 16, alignItems: "center" },
  buttonText: { color: colors.primaryText, fontWeight: "700" },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: 20,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardLabel: { color: colors.muted, textTransform: "uppercase", letterSpacing: 1.4, fontSize: 11 },
  cardValue: { color: colors.text, fontSize: 28, fontWeight: "700", marginTop: 8 },
  cardText: { color: colors.text, marginTop: 8 },
});
