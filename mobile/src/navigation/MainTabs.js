import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { HomeScreen } from "@/screens/HomeScreen";
import { SocialScreen } from "@/screens/SocialScreen";
import { ControlScreen } from "@/screens/ControlScreen";
import { RoastScreen } from "@/screens/RoastScreen";
import { ProfileScreen } from "@/screens/ProfileScreen";
import { CapsuleTabBar } from "@/components/CapsuleTabBar";
import { View, StyleSheet } from "react-native";

const Tab = createBottomTabNavigator();

export function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => (
        <View style={styles.tabShell}>
          <CapsuleTabBar {...props} />
        </View>
      )}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Social" component={SocialScreen} />
      <Tab.Screen name="Control" component={ControlScreen} />
      <Tab.Screen name="Roast" component={RoastScreen} />
      <Tab.Screen name="Me" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabShell: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
  },
});
