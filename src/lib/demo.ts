// Screenshot mode, for the App Store images made in CI (tools/screenshots.sh).
// Only active when the iOS app is launched with the argument "-SnuffelDemo YES"
// (simctl launch); a normal start never sees it. It fills the phone with a
// sample dog, reminders, "my vet" and one real AI conversation, once.
import { Platform, Settings } from "react-native";
import { addChat, ask, loadChat } from "./ai";
import { kvGet, kvSet } from "./db";
import { addMonths, isoDate, saveDog, setReminder, today } from "./dogs";
import { search } from "./places";
import { setMyVet } from "./saved";

export function isDemo(): boolean {
  if (Platform.OS !== "ios") return false;
  try { return Settings.get("SnuffelDemo") === "YES" || Settings.get("SnuffelDemo") === true; } catch { return false; }
}

const DEMO_SPOT = { lat: 52.3600, lon: 4.8852 };   // Amsterdam, Vondelpark

const QUESTION: Record<string, string> = {
  nl: "Bobbie eet sinds gisteren minder en is wat lusteloos, maar drinkt wel. Moet ik naar de dierenarts?",
  en: "Since yesterday Bobbie is eating less and seems a bit lethargic, but she is drinking. Should I see a vet?"
};

export async function seedDemo(lang: string, emergencyLabel: string): Promise<void> {
  if (!isDemo() || (await kvGet("demoSeeded")) === lang) return;
  const dogId = await saveDog({ name: "Bobbie", breed: "Labrador Retriever", birth: "2019-05-12", weight: 29, sex: "female", neutered: true, photo: null });
  await setReminder(dogId, "vaccination", addMonths(today(), 1));
  await setReminder(dogId, "deworming", addMonths(today(), 2));
  await setReminder(dogId, "flea_tick", isoDate(new Date(Date.now() + 9 * 24 * 3600 * 1000)));
  const vets = (await search(DEMO_SPOT.lat, DEMO_SPOT.lon, 2000).catch(() => [])).filter((p) => p.cat === "vet" && !p.chain && p.phone);
  if (vets[0]) await setMyVet(vets[0], true);
  if (!(await loadChat(dogId)).length) {
    const q = { role: "user" as const, content: QUESTION[lang] || QUESTION.en };
    const r = await ask([q], lang, emergencyLabel, { id: dogId, name: "Bobbie", breed: "Labrador Retriever", birth: "2019-05-12", weight: 29, sex: "female", neutered: true, photo: null });
    if (!("error" in r)) {
      await addChat(dogId, q);
      await addChat(dogId, { role: "assistant", content: r.reply, urgency: r.urgency, topic: r.topic });
    }
  }
  await kvSet("demoSeeded", lang);
}
