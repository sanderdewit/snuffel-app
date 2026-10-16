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

export async function startListening(lang: string): Promise<VoiceProblem | null> {
  if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) return "unavailable";
  const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
  if (!perm.granted) return "denied";
  Speech.stop();
  ExpoSpeechRecognitionModule.start({
    lang: speechLocale(lang),
    interimResults: true,
    continuous: false,
    addsPunctuation: true,
    requiresOnDeviceRecognition: ExpoSpeechRecognitionModule.supportsOnDeviceRecognition(),
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

