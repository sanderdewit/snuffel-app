// Screenshot mode, for the store images made in CI (tools/screenshots.sh, and
// tools/screenshots-android.sh). On iOS only when the app is launched with the
// argument "-SnuffelDemo YES" (simctl launch); on Android only in a separate
// screenshot build. A normal start never sees it. It fills the phone with a
// sample dog, reminders, "my vet" and one real AI conversation, once, in the
// app's language (texts in demotexts.ts).
import { Platform, Settings } from "react-native";
import { isDemo } from "./clock";
import { Asset } from "expo-asset";
import { File, Paths } from "expo-file-system";
import poodle from "../../assets/icon.png";
import { addChat, ask, loadChat } from "./ai";
import { CONFIG } from "./config";
import { kvGet, kvSet } from "./db";
import { addMonths, isoDate, saveDog, setReminder, today } from "./dogs";
import { search } from "./places";
import { setMyVet } from "./saved";
import { addRecord } from "./dogfile";
import { demoTexts } from "./demotexts";

// Whether the app runs in screenshot mode: in clock.ts, which places.ts uses too.
export { isDemo };

/** Screen to open at launch ("-SnuffelDemoRoute /emergency"): links would show iOS's "Open in…?" prompt. */
export function demoRoute(): string | null {
  if (!isDemo() || Platform.OS !== "ios") return null;   // Android screenshots open screens via app links
  try { const r = Settings.get("SnuffelDemoRoute"); return typeof r === "string" && r.startsWith("/") ? r : null; } catch { return null; }
}

const DEMO_SPOT ={ lat: 52.3600, lon: 4.8852 };   // Amsterdam, Vondelpark

// The app icon (an illustration of a real mini poodle) as Bobbie's photo.
// On Android release builds bundled images live inside the APK and can't be
// copied as a file, so there the same picture comes from the website.
async function demoPhoto(): Promise<string | null> {
  try {
    const asset = Asset.fromModule(poodle);
    await asset.downloadAsync();
    const dest = new File(Paths.document, `dog-demo.png`);
    if (!dest.exists) await new File(asset.localUri!).copy(dest);
    return dest.uri;
  } catch { /* try the website copy */ }
  try {
    const dest = new File(Paths.document, `dog-demo.jpg`);
    if (!dest.exists) await File.downloadFileAsync(CONFIG.website + "img/bobbie.jpg", dest);
    return dest.uri;
  } catch { return null; }
}

/** Fills the app once per language; `t` is the app's translator (button and entry labels). */
export async function seedDemo(lang: string, t: (key: string) => string): Promise<void> {
  if (!isDemo() || (await kvGet("demoSeeded")) === lang) return;
  const breed = { breedId: "fci-172-miniature", breed: null, breedSize: null, breedMix: [] };   // miniature poodle
  const dogId = await saveDog({ name: "Bobbie", ...breed, birth: "2019-05-12", weight: 6.5, sex: "female", neutered: true, photo: await demoPhoto() });
  await setReminder(dogId, "vaccination", addMonths(today(), 1));
  await setReminder(dogId, "deworming", addMonths(today(), 2));
  await setReminder(dogId, "flea_tick", isoDate(new Date(Date.now() + 9 * 24 * 3600 * 1000)));
  const tx = demoTexts(lang);
  const weight = t("app_rec_weight");   // the title the app itself gives a weight entry
  const ago = (days: number) => isoDate(new Date(Date.now() - days * 864e5));
  for (const r of [
    { kind: "allergy" as const, date: ago(700), title: tx.allergy, details: null, value: null },
    { kind: "weight" as const, date: ago(400), title: weight, details: null, value: 6.1 },
    { kind: "visit" as const, date: ago(57), title: tx.earInfection, details: tx.earCleaned, value: null },
    { kind: "medication" as const, date: ago(57), title: tx.earDrops, details: tx.earDropsDose, value: null },
    { kind: "behaviour" as const, date: ago(20), title: tx.barks, details: tx.barksPractice, value: null },
    { kind: "weight" as const, date: ago(12), title: weight, details: null, value: 6.5 }
  ]) await addRecord({ dogId, ...r });
  const vets = (await search(DEMO_SPOT.lat, DEMO_SPOT.lon, 2000).catch(() => [])).filter((p) => p.cat === "vet" && !p.chain && p.phone);
  if (vets[0]) await setMyVet(vets[0], true);
  if (!(await loadChat(dogId)).length) {
    const q = { role: "user" as const, content: tx.question };
    const r = await ask([q], lang, { emergency: t("emergencyBtn"), lost: "" }, { id: dogId, name: "Bobbie", ...breed, birth: "2019-05-12", weight: 6.5, sex: "female", neutered: true, photo: null });
    if (!("error" in r)) {
      await addChat(dogId, q);
      await addChat(dogId, { role: "assistant", content: r.reply, urgency: r.urgency, topic: r.topic, sig: r.sig, parts: r.parts });
    }
  }
  await kvSet("demoSeeded", lang);
}
