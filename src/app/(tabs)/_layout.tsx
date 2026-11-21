import { useEffect } from "react";
import type { ColorValue } from "react-native";
import { Tabs, router } from "expo-router";
import { demoRoute } from "../../lib/demo";
import * as QuickActions from "expo-quick-actions";
import { useQuickActionRouting } from "expo-quick-actions/router";
import { useI18n } from "../../i18n";
import { Symbol, type SymbolName } from "../../ui/Icon";
import { useTheme } from "../../ui/theme";

// Line icons that take the tab's colour. The chosen tab's icon is filled, the
// others are outlines: that shows the chosen tab without relying on colour alone.
const icon = (filled: SymbolName, outline: SymbolName) => ({ focused, color, size }: { focused: boolean; color: ColorValue; size: number }) =>
  <Symbol name={focused ? filled : outline} size={size} color={color as string} />;

export default function TabsLayout() {
  const { t } = useI18n();
  const { C } = useTheme();

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
    <Tabs screenOptions={{ tabBarActiveTintColor: C.link, tabBarInactiveTintColor: C.muted, headerTintColor: C.text, tabBarLabelStyle: { fontWeight: "600" } }}>
      <Tabs.Screen name="index" options={{ title: t("app_tab_find"), tabBarIcon: icon("map-search", "map-search-outline"), headerShown: false }} />
      {/* Emergency is red whether it is chosen or not, so it can be found at a glance */}
      <Tabs.Screen name="emergency" options={{ title: t("emergencyBtn"), tabBarIcon: icon("alarm-light", "alarm-light-outline"),
        tabBarActiveTintColor: C.danger, tabBarInactiveTintColor: C.danger, tabBarLabelStyle: { fontWeight: "700" } }} />
      <Tabs.Screen name="saved" options={{ title: t("app_tab_saved"), tabBarIcon: icon("bookmark", "bookmark-outline") }} />
      <Tabs.Screen name="dogs" options={{ title: t("app_tab_dogs"), tabBarIcon: icon("paw", "paw-outline") }} />
      <Tabs.Screen name="ask" options={{ title: t("app_tab_ask"), headerTitle: t("app_askTitle"), tabBarIcon: icon("message-text", "message-text-outline") }} />
    </Tabs>
  );
}
