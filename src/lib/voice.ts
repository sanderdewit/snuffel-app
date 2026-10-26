// Voice for the AI chat, entirely through the phone's own services: speech
// recognition (Apple / Google; on the device itself where the phone supports it)
// and text-to-speech with the phone's best voice. Snuffel never receives audio.
// Conversation mode (ask.tsx) loops: speak the short answer, listen again.
import * as Speech from "expo-speech";
import { getLocales } from "expo-localization";
import { ExpoSpeechRecognitionModule } from "expo-speech-recognition";

// Region to pair with a language when the phone's own locale is another language.
const REGION: Record<string, string> = {
  en: "GB", nb: "NO", sv: "SE", da: "DK", el: "GR", uk: "UA", ca: "ES", et: "EE",
  sq: "AL", sl: "SI", cs: "CZ", sr: "RS"
};

/** BCP-47 tag for the app language, preferring the phone's own region (nl-BE stays nl-BE). */
export function speechLocale(lang: string): string {
  const own = getLocales().find((l) => (l.languageCode || "").toLowerCase() === lang);
  if (own && own.languageTag) return own.languageTag;
  return `${lang}-${REGION[lang] || lang.toUpperCase()}`;
}

export type VoiceProblem = "unavailable" | "denied";

// The locales the recognizer knows, and those it can run on the device itself
// (looked up once). "nl_NL" and "nl-NL" are the same here.
const norm = (l: string) => l.replace("_", "-").toLowerCase();
let known: Promise<{ all: Map<string, string>; installed: Set<string> }> | null = null;
function recognizerLocales() {
  if (!known) {
    known = ExpoSpeechRecognitionModule.getSupportedLocales({})
      .then((r) => ({ all: new Map(r.locales.map((l) => [norm(l), l] as [string, string])), installed: new Set(r.installedLocales.map(norm)) }))
      .catch(() => ({ all: new Map<string, string>(), installed: new Set<string>() }));
  }
  return known;
}

// A locale the recognizer supports: the phone's own region, then the usual
// one, then any region of the language (an English phone set to the
// Netherlands asks for "en-NL", which Apple doesn't recognise).
async function pickLocale(lang: string): Promise<{ locale: string; onDevice: boolean }> {
  const { all, installed } = await recognizerLocales();
  const wanted = [speechLocale(lang), `${lang}-${REGION[lang] || lang.toUpperCase()}`];
  const key = wanted.map(norm).find((k) => all.has(k))
    || [...all.keys()].find((k) => k.split("-")[0] === lang);
  const locale = key ? all.get(key)!.replace("_", "-") : wanted[0];
  // On the device only when its model is there; otherwise Apple / Google's
  // service. A locale whose on-device start failed once goes to the service.
  const onDevice = ExpoSpeechRecognitionModule.supportsOnDeviceRecognition()
    && installed.has(norm(locale)) && !serverOnly.has(norm(locale));
  return { locale, onDevice };
}
const serverOnly = new Set<string>();
let last: { locale: string; onDevice: boolean } | null = null;

/** After an error: if the last start ran on the device, try the service next time. */
export function retryOnServer(): boolean {
  if (!last || !last.onDevice) return false;
  serverOnly.add(norm(last.locale));
  return true;
}

export async function startListening(lang: string): Promise<VoiceProblem | null> {
  if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) return "unavailable";
  const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
  if (!perm.granted) return "denied";
  Speech.stop();
  last = await pickLocale(lang);
  ExpoSpeechRecognitionModule.start({
    lang: last.locale,
    interimResults: true,
    continuous: false,
    addsPunctuation: true,
    requiresOnDeviceRecognition: last.onDevice,
    contextualStrings: ["Snuffel", "dierenarts", "vet", "puppy"]
  });
  return null;
}

export const stopListening = () => ExpoSpeechRecognitionModule.stop();

// The most natural voice the phone has for this language: an "Enhanced" one
// (iOS premium / Android high-quality) in the phone's own region when possible.
// Looked up once per locale; null = the system default.
const voices = new Map<string, Promise<string | null>>();
function bestVoice(locale: string): Promise<string | null> {
  if (!voices.has(locale)) {
    voices.set(locale, Speech.getAvailableVoicesAsync().then((all) => {
      const norm = (l: string) => l.replace("_", "-").toLowerCase();
      const lang = locale.split("-")[0].toLowerCase();
      const fits = all.filter((v) => norm(v.language).split("-")[0] === lang);
      const score = (v: Speech.Voice) => (v.quality === Speech.VoiceQuality.Enhanced ? 2 : 0) + (norm(v.language) === locale.toLowerCase() ? 1 : 0);
      fits.sort((a, b) => score(b) - score(a));
      return fits[0] ? fits[0].identifier : null;
    }).catch(() => null));
  }
  return voices.get(locale)!;
}

export function speak(text: string, lang: string, onDone?: () => void) {
  Speech.stop();
  const language = speechLocale(lang);
  bestVoice(language).then((voice) =>
    Speech.speak(text, { language, ...(voice ? { voice } : {}), onDone, onStopped: onDone, onError: onDone }));
}
export const stopSpeaking = () => Speech.stop();

