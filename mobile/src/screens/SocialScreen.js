import React, { useEffect, useState } from "react";
import { View, Text, Pressable, FlatList, StyleSheet } from "react-native";
import { useAppStore } from "@/store/appStore";
import { generateNearbySmokers } from "@/utils/social";
import { colors, radius, spacing } from "@/theme/tokens";

export function SocialScreen({ navigation }) {
  const radarUsers = useAppStore((state) => state.social.radarUsers);
  const visibleOnRadar = useAppStore((state) => state.settings.visibleOnRadar);
  const setRadarUsers = useAppStore((state) => state.setRadarUsers);
  const clearRadarUsers = useAppStore((state) => state.clearRadarUsers);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    clearRadarUsers();
    return () => clearRadarUsers();
  }, [clearRadarUsers]);

  const startScan = () => {
    setScanning(true);
    setTimeout(() => {
      setRadarUsers(generateNearbySmokers());
      setScanning(false);
    }, 1200);
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Social</Text>
      <Text style={styles.subtitle}>Radar visibility: {visibleOnRadar ? "On" : "Off"}</Text>
      <Pressable onPress={startScan} style={styles.button}>
        <Text style={styles.buttonText}>{scanning ? "Scanning..." : "Radar Scan"}</Text>
      </Pressable>
      <FlatList
        data={radarUsers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.username}</Text>
            <Text style={styles.cardText}>{item.status}</Text>
            <View style={styles.row}>
              <Pressable onPress={() => navigation.navigate("Chat", { userId: item.id, username: item.username })} style={styles.inlineButton}>
                <Text style={styles.inlineButtonText}>Message</Text>
              </Pressable>
              <Pressable style={[styles.inlineButton, styles.secondaryInline]}>
                <Text style={styles.inlineButtonText}>Connect</Text>
              </Pressable>
            </View>
          </View>
        )}
        contentContainerStyle={{ paddingVertical: spacing.md, gap: spacing.md }}
        ListEmptyComponent={<Text style={styles.empty}>No nearby users yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, padding: spacing.xl },
  title: { fontSize: 30, fontWeight: "700", color: colors.text },
  subtitle: { color: colors.muted, marginTop: 6, marginBottom: spacing.md },
  button: { backgroundColor: colors.primary, borderRadius: radius.pill, padding: 16, alignItems: "center" },
  buttonText: { color: colors.primaryText, fontWeight: "700" },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: 8 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
  cardText: { color: colors.text },
  row: { flexDirection: "row", gap: 10, marginTop: 6 },
  inlineButton: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingVertical: 10, paddingHorizontal: 14 },
  secondaryInline: { backgroundColor: "#273244" },
  inlineButtonText: { color: colors.primaryText, fontWeight: "700" },
  empty: { color: colors.muted, marginTop: spacing.lg },
});
