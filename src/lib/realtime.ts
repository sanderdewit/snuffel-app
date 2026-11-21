// AI voice conversation (beta): a live spoken conversation with a realtime AI
// model over WebRTC. Snuffel's /api/voice takes this phone's offer, sets up the
// session (instructions, voice) with Azure OpenAI in the EU and returns the
// answer; the app never holds a key. Audio then flows directly between the
// phone and Azure; the data channel only carries the AI's transcript and speech
// events (the server asks for webrtcfilter=on), which the screen shows. The
// owner's own words are not transcribed: that needs a transcription model that
// isn't available in the EU data zone.
// When the owner hangs up (or the time is up) with a dog chosen, the microphone
// and the AI's voice stop at once, and the same session is asked for one text
// answer outside the conversation: a note for the dog's file (voicenote.ts),
// made from what the model already heard. The connection stays up only for
// that answer, at most NOTE_WAIT_MS.
// During the call the microphone is checked from the connection's statistics
// (micwatch.ts): when the phone stops sending audio, the iPhone's recording is
// restarted once, and if that doesn't help the call ends with a message, instead
// of "Listening…" for ever.
import { AppState, Platform } from "react-native";
// LiveKit's maintained fork of react-native-webrtc: same API, supports the New Architecture.
import { AudioDeviceModule, audioDeviceModuleEvents, type AutomaticAppleAudioConfiguration, mediaDevices, MediaStream, RTCPeerConnection } from "@livekit/react-native-webrtc";
import { ExpoSpeechRecognitionModule } from "expo-speech-recognition";
import { CONFIG } from "./config";
import { betaCode } from "./beta";
import { clock, today } from "./dates";
import { ageMonths, type Dog } from "./dogs";
import { signCategory } from "./dogsummary";
import { installId } from "./install";
import { parseVoiceNote, type VoiceNote } from "./voicenote";
import { breedForServer, breeds } from "./breeds";
import { micSample, micWatch } from "./micwatch";

export type VoiceState = "connecting" | "listening" | "hearing" | "thinking" | "speaking" | "ended";   // hearing: the AI hears the owner speak
export type VoiceEnd = "done" | "time" | "beta" | "rate_limited" | "unavailable" | "mic" | "nomic" | "failed";   // mic: no permission; nomic: no sound from it
export interface VoiceLine { role: "user" | "assistant"; text: string }

export interface VoiceHandlers {
  onState(s: VoiceState): void;
  onLines(lines: VoiceLine[]): void;          // the transcript so far
  onConnected(maxSeconds: number): void;      // the conversation is live
  onEnd(reason: VoiceEnd, noting: boolean, detail?: string): void;   // once; noting: the note for the dog's file is on its way (onNote follows); detail: the audio state, after "nomic"
  onNote?(note: VoiceNote | null): void;      // after onEnd(_, true): the note, or null (nothing to note, or no answer in time)
  onLevel?(level: number | undefined): void;  // the microphone's level (0-1) a few times a second; undefined: not known
}

/**
 * A conversation being set up or running; both work at any moment.
 * hangUp: the owner ends it (with a dog chosen, the note follows); close: ends it at once, without a note.
 */
export interface VoiceCall { hangUp(): void; close(): void }

const NOTE_WAIT_MS = 8000;
const MIC_CHECK_MS = 250, MIC_DEAD_MS = 4000;
// The request for the note: a system message, answered as the session's instructions
// (set by /api/voice) describe. response.create gets no `instructions`: they would
// replace the session's for that answer, and with them the file note rules, the
// date, the language and the dog.
const NOTE_REQUEST = "(The call has ended. Reply only with the JSON note for the dog's file, as described under FILE NOTE AT THE END OF THE CALL.)";

/** Starts a conversation right away and returns its handle at once. */
export function startVoice(lang: string, labels: { emergency: string; lost: string }, dog: Dog | null, h: VoiceHandlers): VoiceCall {
  let ended = false, closed = false, noting = false, spoke = false;
  let timer: ReturnType<typeof setTimeout> | null = null, noteTimer: ReturnType<typeof setTimeout> | null = null;
  let micTimer: ReturnType<typeof setInterval> | null = null;
  let pc: RTCPeerConnection | null = null, mic: MediaStream | null = null;
  let events: ReturnType<RTCPeerConnection["createDataChannel"]> | null = null;
  const send = (m: object) => { try { events?.send(JSON.stringify(m)); } catch { /* closed */ } };
  const request = new AbortController();
  // The AI's transcript, one line per conversation item (deltas and "done" of
  // one answer carry the same item_id; an interrupted answer just stops).
  const order: string[] = [];
  const byItem = new Map<string, VoiceLine>();
  const publish = () => h.onLines(order.map((id) => byItem.get(id)!).filter((l) => l.text.trim()));
  // The app going to the background ends the call at once, without a note: no
  // audio left running, and the time limit can't be outlived by a suspended timer.
  // Only "background": iOS reports "inactive" while the microphone prompt is shown.
  const appState = AppState.addEventListener("change", (s) => { if (s === "background") end("done"); });

  // Releases everything: microphone, connection, timers.
  function close() {
    if (closed) return;
    closed = true;
    if (timer) clearTimeout(timer);
    if (noteTimer) clearTimeout(noteTimer);
    if (micTimer) clearInterval(micTimer);
    appState.remove();
    request.abort();                                   // a session still being set up
    mic?.getTracks().forEach((t) => t.stop());
    try { pc?.close(); } catch { /* already closed */ }
  }

  // The call is over. note: the owner hung up or the time is up, so a note may follow
  // (only with a dog and a live data channel). Ending again while the note is on its
  // way (the screen closes, the app goes to the background, the connection drops)
  // stops waiting for it.
  function end(reason: VoiceEnd, note = false, detail?: string) {
    if (ended) { noteDone(null); return; }
    ended = true;
    if (timer) clearTimeout(timer);
    if (micTimer) clearInterval(micTimer);
    noting = note && !!dog && !!h.onNote && events?.readyState === "open";
    if (noting) { silence(); askNote(); } else close();
    h.onState("ended");
    h.onEnd(reason, noting, detail);
  }

  // The microphone, checked a few times a second once connected (micwatch.ts); the
  // level goes to the screen. No audio for MIC_DEAD_MS: restart the recording once,
  // then end the call ("nomic", with a note only if the owner had already spoken).
  function watchMic() {
    const watch = micWatch(MIC_DEAD_MS);
    let revived: string | null = null, busy = false, last: ReturnType<typeof micSample> = {};
    micTimer = setInterval(() => {
      if (busy || ended || !pc) return;
      if (pc.connectionState !== "connected") { watch.reset(); return; }
      busy = true;
      pc.getStats().then(async (report) => {
        if (ended) return;
        last = micSample(report);
        h.onLevel?.(last.level);
        if (watch.check(last, Date.now()) !== "dead") return;
        if (revived == null) { revived = await reviveMic(); watch.reset(); return; }
        end("nomic", spoke, audioState(last, revived));
      }).catch(() => undefined).finally(() => { busy = false; });
    }, MIC_CHECK_MS);
  }

  // What can be restarted from here: the track, the iPhone's mute and recording.
  // Returns what was found, for the detail line.
  async function reviveMic(): Promise<string> {
    const found: string[] = [];
    try { mic?.getAudioTracks().forEach((t) => { if (!t.enabled) { found.push("track-off"); t.enabled = true; } }); } catch { /* ended */ }
    if (Platform.OS === "ios") {
      try { if (AudioDeviceModule.isMicrophoneMuted()) { found.push("muted"); await AudioDeviceModule.setMicrophoneMuted(false); } } catch { found.push("muted?"); }
      try {
        if (AudioDeviceModule.isRecording()) { found.push("rec"); await AudioDeviceModule.stopRecording(); } else found.push("norec");
        await AudioDeviceModule.startRecording();
      } catch (e) { found.push("err:" + String((e as Error)?.message || e).slice(0, 40)); }
    }
    return found.join(",") || "-";
  }

  // One line on the audio state, shown small under "nomic" for a screenshot.
  function audioState(s: ReturnType<typeof micSample>, revived: string): string {
    const part = (label: string, f: () => unknown) => { try { return `${label} ${String(f())}`; } catch { return `${label} ?`; } };
    const ios = Platform.OS === "ios";
    return [
      ios && part("session", () => { const a = ExpoSpeechRecognitionModule.getAudioSessionCategoryAndOptionsIOS(); return `${a.category}/${a.mode}`; }),
      ios && part("engine", () => (AudioDeviceModule.isEngineRunning() ? "on" : "off")),
      ios && part("rec", () => (AudioDeviceModule.isRecording() ? "yes" : "no")),
      ios && part("muted", () => (AudioDeviceModule.isMicrophoneMuted() ? "yes" : "no")),
      ios && part("vp", () => (AudioDeviceModule.isVoiceProcessingEnabled() ? "on" : "off")),
      ios && part("avail", () => { const a = AudioDeviceModule.getEngineAvailability(); return `${a.isInputAvailable ? "in" : "-"}${a.isOutputAvailable ? "out" : "-"}`; }),
      part("pc", () => `${pc?.connectionState}/${pc?.iceConnectionState}`),
      part("track", () => { const t = mic?.getAudioTracks()[0]; return t ? `${t.readyState}${t.enabled ? "" : ",off"}${t.muted ? ",muted" : ""}` : "none"; }),
      part("sent", () => `${s.samples ?? "?"}s/${s.packets ?? "?"}p`),
      part("spoke", () => (spoke ? "yes" : "no")),
      part("revive", () => revived)
    ].filter(Boolean).join(" · ");
  }

  // Microphone and the AI's voice stop at once; the connection stays up for the note.
  function silence() {
    mic?.getTracks().forEach((t) => t.stop());        // nothing more is sent
    try { pc?.getSenders().forEach((s) => { void s.replaceTrack(null); }); } catch { /* closed */ }
    if (Platform.OS === "ios") {
      try { if (AudioDeviceModule.isRecording()) AudioDeviceModule.stopRecording().catch(() => undefined); } catch { /* older native module */ }
    }
    try { pc?.getReceivers().forEach((r) => { if (r.track) r.track.enabled = false; }); } catch { /* closed */ }   // muted here at once
    send({ type: "response.cancel" });                // and stopped there: cancel first, then clear (WebRTC)
    send({ type: "output_audio_buffer.clear" });
    send({ type: "input_audio_buffer.clear" });
  }

  // One text-only answer outside the default conversation, made from the conversation so far.
  function askNote() {
    send({ type: "conversation.item.create", item: { type: "message", role: "system", content: [{ type: "input_text", text: NOTE_REQUEST }] } });
    send({ type: "response.create", response: { conversation: "none", output_modalities: ["text"], metadata: { snuffel: "file_note" }, max_output_tokens: 1000 } });
    noteTimer = setTimeout(() => noteDone(null), NOTE_WAIT_MS);
  }

  function noteDone(answer: string | null) {
    if (!noting) { close(); return; }
    noting = false;
    close();
    h.onNote?.(answer == null ? null : parseVoiceNote(answer, today(), signCategory));
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
      const channel = pc.createDataChannel("oai-events");
      events = channel;
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
            channel.send(JSON.stringify({ type: "conversation.item.create",
              item: { type: "message", role: "user", content: [{ type: "input_text", text: "(The call has started.)" }] } }));
          }
          channel.send(JSON.stringify({ type: "response.create" }));
        } catch { /* closed */ }
      };
      channel.addEventListener("open", () => { greet(); setTimeout(greet, 4000); });
      channel.addEventListener("message", (e: { data?: unknown }) => {
        let m: { type?: string; item_id?: string; transcript?: string; delta?: string; text?: string;
          response?: { metadata?: Record<string, unknown> | null; output?: { content?: { text?: unknown }[] }[] } };
        try { m = JSON.parse(String(e.data)); } catch { return; }
        if (ended) {
          // Only the note is still awaited. The call's own answers are audio, so text
          // output is the note (webrtcfilter=on passes response.output_text.*, not
          // response.done with its metadata; that one counts too, should it come).
          if (m.type === "response.output_text.done") noteDone(typeof m.text === "string" ? m.text : null);
          else if (m.type === "response.done" && m.response?.metadata?.snuffel === "file_note") {
            const text = (m.response.output || []).flatMap((o) => o.content || []).find((c) => typeof c.text === "string")?.text;
            noteDone(typeof text === "string" ? text : null);
          }
          return;
        }
        if (m.type === "input_audio_buffer.speech_started" || m.type === "output_audio_buffer.started" || m.type === "response.output_audio_transcript.delta") heard = true;
        const line = (role: VoiceLine["role"]) => {
          const id = m.item_id || "x" + order.length;
          let l = byItem.get(id);
          if (!l) { l = { role, text: "" }; byItem.set(id, l); order.push(id); }
          return l;
        };
        switch (m.type) {
          case "input_audio_buffer.speech_started": h.onState("hearing"); break;
          case "input_audio_buffer.speech_stopped": spoke = true; h.onState("thinking"); break;
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
          today: today(), time: clock(),   // the phone's date and time: "yesterday" in the note, the out-of-hours vet in the evening
          dog: dog ? { name: dog.name || undefined, ...breedForServer(breeds(), dog), ageMonths: ageMonths(dog.birth) ?? undefined,
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
      timer = setTimeout(() => end("time", true), maxSeconds * 1000);
      h.onConnected(maxSeconds);
      h.onState("listening");
      watchMic();
    } catch {
      end(ended ? "done" : "failed");                  // an abort after hanging up is not a failure
    }
  })();

  return { hangUp: () => end("done", true), close: () => end("done") };
}
