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
import { addRecord } from "./dogfile";

export function isDemo(): boolean {
  if (Platform.OS !== "ios") return false;
  try { return Settings.get("SnuffelDemo") === "YES" || Settings.get("SnuffelDemo") === true; } catch { return false; }
}

/** Screen to open at launch ("-SnuffelDemoRoute /emergency"): links would show iOS's "Open in…?" prompt. */
export function demoRoute(): string | null {
  if (!isDemo()) return null;
  try { const r = Settings.get("SnuffelDemoRoute"); return typeof r === "string" && r.startsWith("/") ? r : null; } catch { return null; }
}

const DEMO_SPOT ={ lat: 52.3600, lon: 4.8852 };   // Amsterdam, Vondelpark

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
  const nl = lang === "nl";
  const ago = (days: number) => isoDate(new Date(Date.now() - days * 864e5));
  for (const r of [
    { kind: "allergy" as const, date: ago(700), title: nl ? "Kip (jeuk en oorontsteking)" : "Chicken (itching and ear infections)", details: null, value: null },
    { kind: "weight" as const, date: ago(400), title: "Weight", details: null, value: 27.5 },
    { kind: "visit" as const, date: ago(57), title: nl ? "Oorontsteking links" : "Ear infection, left", details: nl ? "Oor schoongemaakt, controle na 2 weken." : "Ear cleaned, check-up after 2 weeks.", value: null },
    { kind: "medication" as const, date: ago(57), title: nl ? "Oordruppels" : "Ear drops", details: nl ? "2x per dag, 7 dagen" : "Twice a day, 7 days", value: null },
    { kind: "behaviour" as const, date: ago(20), title: nl ? "Blaft naar de bezorger" : "Barks at the delivery driver", details: nl ? "Oefenen met belonen bij de deur." : "Practising rewards at the door.", value: null },
    { kind: "weight" as const, date: ago(12), title: "Weight", details: null, value: 29 }
  ]) await addRecord({ dogId, ...r });
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
