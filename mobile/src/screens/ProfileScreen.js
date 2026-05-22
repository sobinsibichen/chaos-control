import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useAppStore } from "@/store/appStore";
import { colors, radius, spacing } from "@/theme/tokens";

export function ProfileScreen() {
  const user = useAppStore((state) => state.auth.user);
  const logout = useAppStore((state) => state.logout);
  const settings = useAppStore((state) => state.settings);

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Profile</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{user?.username || "Guest"}</Text>
        <Text style={styles.cardText}>{user?.email || ""}</Text>
        <Text style={styles.cardText}>Cigarette price: {settings.currencySymbol}{settings.cigarettePrice}</Text>
      </View>
      <Pressable onPress={logout} style={styles.button}>
        <Text style={styles.buttonText}>Logout</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, padding: spacing.xl },
  title: { fontSize: 30, fontWeight: "700", color: colors.text, marginBottom: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, marginBottom: spacing.md },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: "700" },
  cardText: { color: colors.muted, marginTop: 8 },
  button: { backgroundColor: colors.primary, padding: 14, borderRadius: radius.pill, alignItems: "center" },
  buttonText: { color: colors.primaryText, fontWeight: "700" },
});
