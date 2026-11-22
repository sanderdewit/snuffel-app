// The time the app reads for "open now" and "closes at": the phone's clock, except in
// screenshot mode (store images, tools/screenshots.sh), where it is a fixed weekday
// morning, so the images show open places instead of "Closed · opens Monday" when the
// screenshots happen to be made in the evening or at the weekend.
// Also the one place that knows whether the app runs in screenshot mode (demo.ts
// re-exports isDemo): this module imports nothing of the app, so places.ts can use it.
import { Platform, Settings } from "react-native";

// Android has no launch arguments: there it is a separate screenshot build
// (EXPO_PUBLIC_SNUFFEL_DEMO=1, inlined at build time); store builds never have it.
const ANDROID_DEMO_BUILD = process.env.EXPO_PUBLIC_SNUFFEL_DEMO === "1";

export function isDemo(): boolean {
  if (Platform.OS === "android") return ANDROID_DEMO_BUILD;
  if (Platform.OS !== "ios") return false;
  try { return Settings.get("SnuffelDemo") === "YES" || Settings.get("SnuffelDemo") === true; } catch { return false; }
}

// Tuesday 24 November 2026, 10:30 in Amsterdam (09:30 UTC); the same day and time go to
// the AI with the sample question (ai.ts), so its answer fits the morning.
const DEMO_NOW = Date.parse("2026-11-24T09:30:00Z");
export const DEMO_DAY = "2026-11-24", DEMO_TIME = "10:30";
let demo: boolean | null = null;

/** Now, as the app should see it for opening hours. */
export function clockNow(): Date {
  if (demo === null) demo = isDemo();
  return demo ? new Date(DEMO_NOW) : new Date();
}
