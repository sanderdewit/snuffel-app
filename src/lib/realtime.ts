// AI voice conversation (beta): a live spoken conversation with a realtime AI
// model over WebRTC. Snuffel's /api/voice takes this phone's offer, sets up the
// session (instructions, voice) with Azure OpenAI in the EU and returns the
// answer; the app never holds a key. Audio then flows directly between the
// phone and Azure; the data channel only carries the AI's transcript and speech
// events (the server asks for webrtcfilter=on), which the screen shows. The
// owner's own words are not transcribed: that needs a transcription model that
// isn't available in the EU data zone.
import { AppState, Platform } from "react-native";
// LiveKit's maintained fork of react-native-webrtc: same API, supports the New Architecture.
import { AudioDeviceModule, audioDeviceModuleEvents, type AutomaticAppleAudioConfiguration, mediaDevices, MediaStream, RTCPeerConnection } from "@livekit/react-native-webrtc";
import { ExpoSpeechRecognitionModule } from "expo-speech-recognition";
import { CONFIG } from "./config";
import { betaCode } from "./beta";
import { ageMonths, type Dog } from "./dogs";
import { installId } from "./install";

export type VoiceState = "connecting" | "listening" | "thinking" | "speaking" | "ended";
export type VoiceEnd = "done" | "time" | "beta" | "rate_limited" | "unavailable" | "mic" | "failed";
export interface VoiceLine { role: "user" | "assistant"; text: string }

export interface VoiceHandlers {
  onState(s: VoiceState): void;
  onLines(lines: VoiceLine[]): void;          // the transcript so far
  onConnected(maxSeconds: number): void;      // the conversation is live
  onEnd(reason: VoiceEnd): void;              // once
}

/** A conversation being set up or running; hangUp works at any moment. */
export interface VoiceCall { hangUp(): void }

/** Starts a conversation right away and returns its handle at once. */
export function startVoice(lang: string, labels: { emergency: string; lost: string }, dog: Dog | null, h: VoiceHandlers): VoiceCall {
  let ended = false, timer: ReturnType<typeof setTimeout> | null = null;
  let pc: RTCPeerConnection | null = null, mic: MediaStream | null = null;
  const request = new AbortController();
  // The AI's transcript, one line per conversation item (deltas and "done" of
  // one answer carry the same item_id; an interrupted answer just stops).
  const order: string[] = [];
  const byItem = new Map<string, VoiceLine>();
  const publish = () => h.onLines(order.map((id) => byItem.get(id)!).filter((l) => l.text.trim()));
  // The app going to the background ends the call: no audio left running, and
  // the time limit can't be outlived by a suspended timer.
  // Only "background": iOS reports "inactive" while the microphone prompt is shown.
  const appState = AppState.addEventListener("change", (s) => { if (s === "background") end("done"); });

  function end(reason: VoiceEnd) {
    if (ended) return;
    ended = true;
    if (timer) clearTimeout(timer);
    appState.remove();
    request.abort();                                   // a session still being set up
    mic?.getTracks().forEach((t) => t.stop());
    try { pc?.close(); } catch { /* already closed */ }
    h.onState("ended");
    h.onEnd(reason);
  }

  (async () => {
    h.onState("connecting");
    // iPhone: a voice-chat session plays through the earpiece by default; this is a
    // conversation with the phone in hand or on the table, so use the speaker
    // (headphones and Bluetooth still take over).
    if (Platform.OS === "ios") {
      try {
        // Tells the native side which engine hooks have a JS handler (none here).
        // Without it every hook counts as handled: the audio engine waits 2 s for
        // JS, then starts without the configuration below, and the microphone
        // never opens. registerGlobals() would do this too; we don't use globals.
        audioDeviceModuleEvents.setupListeners();
        // Record-and-play throughout: a playback-only session while the AI speaks
        // (the engine starts with playout) left the microphone closed.
        const duplex: AutomaticAppleAudioConfiguration = { audioCategory: "playAndRecord", audioMode: "voiceChat", audioCategoryOptions: ["defaultToSpeaker", "allowBluetooth", "allowBluetoothA2DP"] };
        AudioDeviceModule.setAutomaticAudioSessionConfiguration({ recording: duplex, playout: duplex, deactivateOnStop: true });
      } catch { /* older native module: default routing */ }
      // And set it up front, as speech-to-text does: the microphone only opened
      // after 🎙️ had been used once, i.e. when the session was already record-and-play.
      try {
        ExpoSpeechRecognitionModule.setCategoryIOS({ category: "playAndRecord", categoryOptions: ["defaultToSpeaker", "allowBluetooth", "allowBluetoothA2DP"], mode: "voiceChat" });
        ExpoSpeechRecognitionModule.setAudioSessionActiveIOS(true);
      } catch { /* the WebRTC engine configures it itself */ }
    }
    try {
      mic = await mediaDevices.getUserMedia({ audio: true, video: false });
    } catch {
      end("mic");
      return;
    }
    if (ended) { mic.getTracks().forEach((t) => t.stop()); return; }   // hung up meanwhile

    try {
      pc = new RTCPeerConnection();
      mic.getAudioTracks().forEach((t) => pc!.addTrack(t, mic!));   // the AI's voice arrives as a remote track and plays by itself
      const events = pc.createDataChannel("oai-events");
      // The model never speaks first by itself, and a bare response.create on an
      // empty conversation isn't reliably answered: open the call with a short
      // turn (as Microsoft's WebRTC sample does), then ask for the greeting the
      // instructions describe. Once more if neither side spoke a few seconds later.
      let heard = false, opened = false;
      const greet = () => {
        if (heard || ended) return;
        try {
          if (!opened) {
            opened = true;
            events.send(JSON.stringify({ type: "conversation.item.create",
              item: { type: "message", role: "user", content: [{ type: "input_text", text: "(The call has started.)" }] } }));
          }
          events.send(JSON.stringify({ type: "response.create" }));
        } catch { /* closed */ }
      };
      events.addEventListener("open", () => { greet(); setTimeout(greet, 4000); });
      events.addEventListener("message", (e: { data?: unknown }) => {
        let m: { type?: string; item_id?: string; transcript?: string; delta?: string };
        try { m = JSON.parse(String(e.data)); } catch { return; }
        if (m.type === "input_audio_buffer.speech_started" || m.type === "output_audio_buffer.started" || m.type === "response.output_audio_transcript.delta") heard = true;
        const line = (role: VoiceLine["role"]) => {
          const id = m.item_id || "x" + order.length;
          let l = byItem.get(id);
          if (!l) { l = { role, text: "" }; byItem.set(id, l); order.push(id); }
          return l;
        };
        switch (m.type) {
          case "input_audio_buffer.speech_started": h.onState("listening"); break;
          case "input_audio_buffer.speech_stopped": h.onState("thinking"); break;
          case "output_audio_buffer.started": h.onState("speaking"); break;
          case "output_audio_buffer.stopped": h.onState("listening"); break;
          case "conversation.item.input_audio_transcription.completed":   // only if the server turns transcription on
            if (m.transcript?.trim()) { line("user").text = m.transcript.trim(); publish(); }
            break;
          case "response.output_audio_transcript.delta": line("assistant").text += m.delta || ""; publish(); break;
          case "response.output_audio_transcript.done": if (m.transcript) { line("assistant").text = m.transcript; publish(); } break;
        }
      });
      pc.addEventListener("connectionstatechange", () => {
        if (pc && (pc.connectionState === "failed" || pc.connectionState === "closed")) end(pc.connectionState === "failed" ? "failed" : "done");
      });

      const offer = await pc.createOffer({});
      await pc.setLocalDescription(offer);

      const timeout = setTimeout(() => request.abort(), 20000);
      const r = await fetch(CONFIG.voiceApi, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Snuffel-Install": await installId(), "X-Snuffel-Beta": (await betaCode()) || "" },
        body: JSON.stringify({
          sdp: offer.sdp, lang, emergencyLabel: labels.emergency, lostLabel: labels.lost,
          dog: dog ? { name: dog.name || undefined, breed: dog.breed || undefined, ageMonths: ageMonths(dog.birth) ?? undefined,
            weightKg: dog.weight ?? undefined, sex: dog.sex ?? undefined, neutered: dog.neutered ?? undefined } : undefined
        }),
        signal: request.signal
      }).finally(() => clearTimeout(timeout));
      if (ended) return;
      if (r.status === 429) { end("rate_limited"); return; }
      if (r.status === 403) {
        const d = await r.json().catch(() => null);
        end(d && d.error === "beta_required" ? "beta" : "failed");
        return;
      }
      if (!r.ok) { end("failed"); return; }
      const d = await r.json();
      if (ended) return;
      if (!d.configured || typeof d.sdp !== "string") { end("unavailable"); return; }
      await pc.setRemoteDescription({ type: "answer", sdp: d.sdp });
      if (ended) return;

      const maxSeconds = Number(d.maxSeconds) > 0 ? Number(d.maxSeconds) : 600;
      timer = setTimeout(() => end("time"), maxSeconds * 1000);
      h.onConnected(maxSeconds);
      h.onState("listening");
    } catch {
      end(ended ? "done" : "failed");                  // an abort after hanging up is not a failure
    }
  })();

  return { hangUp: () => end("done") };
}
