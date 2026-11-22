import { useEffect, useRef } from "react";
import type { ColorValue } from "react-native";
import { Tabs, router, usePathname } from "expo-router";
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

  // Screenshot mode only: open the screen named at launch. On a busy machine the
  // navigator may not be ready after 800 ms and the push is lost (the app stayed on
  // Find): push again every 1.5 s until the screen is there (at most five times).
  const pathname = usePathname();
  const at = useRef(pathname);
  at.current = pathname;
  useEffect(() => {
    const route = demoRoute();
    if (!route) return;
    const target = route.split("?")[0];
    let tries = 0, timer: ReturnType<typeof setTimeout>;
    const go = () => {
      if (tries > 0 && (at.current === target || tries > 5)) return;
      tries++;
      router.push(route as never);
      timer = setTimeout(go, 1500);
    };
    timer = setTimeout(go, 800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: C.link, tabBarInactiveTintColor: C.muted, headerTintColor: C.text, tabBarLabelStyle: { fontWeight: "600" } }}>
      <Tabs.Screen name="index" options={{ title: t("app_tab_find"), tabBarIcon: icon("map-search", "map-search-outline"), headerShown: false }} />
      {/* Emergency is red whether it is chosen or not, so it can be found at a glance. The tab
          bar takes its tint colours from the chosen tab only, so the red is set on this tab's
          own icon and label (a label style's colour wins over the tint). */}
      <Tabs.Screen name="emergency" options={{ title: t("emergencyBtn"),
        tabBarIcon: ({ focused, size }) => <Symbol name={focused ? "alarm-light" : "alarm-light-outline"} size={size} color={C.danger} />,
        tabBarLabelStyle: { fontWeight: "700", color: C.danger } }} />
      <Tabs.Screen name="saved" options={{ title: t("app_tab_saved"), tabBarIcon: icon("bookmark", "bookmark-outline") }} />
      <Tabs.Screen name="dogs" options={{ title: t("app_tab_dogs"), tabBarIcon: icon("paw", "paw-outline") }} />
      <Tabs.Screen name="ask" options={{ title: t("app_tab_ask"), headerTitle: t("app_askTitle"), tabBarIcon: icon("message-text", "message-text-outline") }} />
    </Tabs>
  );
}
