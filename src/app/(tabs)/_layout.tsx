import { useEffect } from "react";
import { Text } from "react-native";
import { Tabs, router } from "expo-router";
import { demoRoute } from "../../lib/demo";
import * as QuickActions from "expo-quick-actions";
import { useQuickActionRouting } from "expo-quick-actions/router";
import { useI18n } from "../../i18n";
import { C } from "../../ui/theme";

const icon = (glyph: string) => ({ focused }: { focused: boolean }) =>
  <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.55 }}>{glyph}</Text>;

export default function TabsLayout() {
  const { t } = useI18n();

  // Home-screen shortcut (long-press the app icon): straight to the nearest open vet.
  useQuickActionRouting();
  useEffect(() => {
    QuickActions.setItems([{ id: "emergency", title: t("app_shortcutEmergency"), icon: "symbol:cross.case.fill", params: { href: "/emergency" } }])
      .catch(() => undefined);
  }, [t]);

  // Screenshot mode only: open the screen named at launch.
  useEffect(() => {
    const route = demoRoute();
    if (!route) return;
    const timer = setTimeout(() => router.push(route as never), 800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: C.brandDark, headerTintColor: C.text }}>
      <Tabs.Screen name="index" options={{ title: t("app_tab_find"), tabBarIcon: icon("🔎"), headerShown: false }} />
      <Tabs.Screen name="emergency" options={{ title: t("emergencyBtn"), tabBarIcon: icon("🚨"), tabBarActiveTintColor: C.danger }} />
      <Tabs.Screen name="saved" options={{ title: t("app_tab_saved"), tabBarIcon: icon("⭐") }} />
      <Tabs.Screen name="dogs" options={{ title: t("app_tab_dogs"), tabBarIcon: icon("🐕") }} />
      <Tabs.Screen name="ask" options={{ title: t("app_tab_ask"), tabBarIcon: icon("💬") }} />
    </Tabs>
  );
}
