import { useEffect } from "react";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { I18nProvider, useI18n } from "../i18n";
import { REMINDER_KINDS, rescheduleAll, setReminderTexts } from "../lib/dogs";
import { C } from "../ui/theme";

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false })
});

// Reminder texts follow the app language; when it changes, pending reminders
// are rescheduled with the new texts.
function ReminderTexts() {
  const { lang, t, tf } = useI18n();
  useEffect(() => {
    const what = (kind: string) => t(REMINDER_KINDS.find((k) => k.kind === kind)!.key);
    setReminderTexts({
      title: (dog, kind) => `${dog.name} · ${what(kind)}`,
      body: (dog, kind) => tf("app_reminderBody", { what: what(kind), name: dog.name })
    });
    rescheduleAll().catch(() => undefined);
  }, [lang, t, tf]);
  return null;
}

// Tapping a reminder opens that dog.
function NotificationLinks() {
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const url = response?.notification.request.content.data?.url;
    if (typeof url === "string" && url.startsWith("/")) router.push(url as never);
  }, [response]);
  return null;
}

function Screens() {
  const { t } = useI18n();
  return (
    <Stack screenOptions={{ headerTintColor: C.brandDark, contentStyle: { backgroundColor: C.bg } }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="place/[id]" options={{ title: "" }} />
      <Stack.Screen name="dog/[id]" options={{ title: t("app_editDog") }} />
      <Stack.Screen name="settings" options={{ title: t("app_settings") }} />
    </Stack>
  );
}

export default function Root() {
  return (
    <I18nProvider>
      <StatusBar style="dark" />
      <ReminderTexts />
      <NotificationLinks />
      <Screens />
    </I18nProvider>
  );
}
