import React, { useMemo, useState } from "react";
import { View, Text, TextInput, FlatList, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { useAppStore } from "@/store/appStore";
import { colors, radius, spacing } from "@/theme/tokens";

export function ChatScreen({ route }) {
  const { userId, username } = route.params;
  const messages = useAppStore((state) => state.social.conversations[userId] || []);
  const addMessage = useAppStore((state) => state.addMessage);
  const [draft, setDraft] = useState("");

  const displayMessages = useMemo(
    () => messages.map((message) => ({ ...message, mine: message.sender === "me" })),
    [messages],
  );

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    addMessage(userId, "me", text);
    setDraft("");
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>{username}</Text>
        <Text style={styles.subtitle}>Online</Text>
      </View>
      <FlatList
        data={displayMessages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.mine ? styles.mine : styles.them]}>
            <Text style={styles.bubbleText}>{item.text}</Text>
          </View>
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No messages yet.</Text>}
      />
      <View style={styles.composer}>
        <TextInput value={draft} onChangeText={setDraft} placeholder="Type a message..." placeholderTextColor={colors.muted} style={styles.input} />
        <Pressable onPress={send} style={styles.send}>
          <Text style={styles.sendText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.xl, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  title: { color: colors.text, fontSize: 22, fontWeight: "700" },
  subtitle: { color: colors.muted, marginTop: 4 },
  list: { padding: spacing.xl, gap: 10, flexGrow: 1 },
  empty: { color: colors.muted, marginTop: spacing.lg },
  bubble: { maxWidth: "80%", padding: 14, borderRadius: 22 },
  mine: { alignSelf: "flex-end", backgroundColor: colors.primary },
  them: { alignSelf: "flex-start", backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  bubbleText: { color: colors.primaryText },
  composer: { flexDirection: "row", gap: 10, padding: spacing.xl, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  input: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 14, color: colors.text },
  send: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 18, justifyContent: "center" },
  sendText: { color: colors.primaryText, fontWeight: "700" },
});
