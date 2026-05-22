import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors, radius } from "@/theme/tokens";

export function CapsuleTabBar({ state, descriptors, navigation }) {
  const items = state.routes.map((route, index) => {
    const focused = state.index === index;
    const options = descriptors[route.key].options;

    return {
      label: options.tabBarLabel || options.title || route.name,
      focused,
      onPress: () => {
        const event = navigation.emit({
          type: "tabPress",
          target: route.key,
          canPreventDefault: true,
        });

        if (!focused && !event.defaultPrevented) {
          navigation.navigate(route.name);
        }
      },
    };
  });

  return (
    <View style={styles.shell}>
      {items.map((item) => (
        <Pressable key={item.label} onPress={item.onPress} style={[styles.tab, item.focused && styles.tabActive]}>
          <Text style={[styles.label, item.focused && styles.labelActive]}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flexDirection: "row",
    alignSelf: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    padding: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 24,
    elevation: 4,
    gap: 4,
  },
  tab: {
    minWidth: 66,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.pill,
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  label: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
  },
  labelActive: {
    color: colors.primaryText,
  },
});
