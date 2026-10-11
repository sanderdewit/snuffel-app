// Voice for the AI chat, entirely through the phone's own services: speech
// recognition (Apple / Google; on the device itself where the phone supports it)
// and text-to-speech. Snuffel never receives audio.
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

export function speak(text: string, lang: string, onDone?: () => void) {
  Speech.stop();
  Speech.speak(text, { language: speechLocale(lang), onDone, onStopped: onDone, onError: onDone });
}
export const stopSpeaking = () => Speech.stop();
