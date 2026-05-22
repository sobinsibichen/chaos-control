import React from "react";
import { View, ActivityIndicator } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAppStore } from "@/store/appStore";
import { AuthNavigator } from "./AuthNavigator";
import { MainTabs } from "./MainTabs";
import { ChatScreen } from "@/screens/ChatScreen";
import { RadarScreen } from "@/screens/RadarScreen";
import { VerificationScreen } from "@/screens/VerificationScreen";
import { colors } from "@/theme/tokens";

const Stack = createNativeStackNavigator();

export function AppNavigator() {
  const isAuthenticated = useAppStore((state) => state.auth.isAuthenticated);
  const bootstrapped = useAppStore((state) => state.bootstrapped);

  if (!bootstrapped) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      ) : (
        <Stack.Screen name="Main" component={MainTabs} />
      )}
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="Radar" component={RadarScreen} />
      <Stack.Screen name="Verification" component={VerificationScreen} />
    </Stack.Navigator>
  );
}
