// Conversation mode helpers, free of native modules (unit-tested in tests/talk.test.ts).

/** Conversation mode ends on a stop phrase ("stop", "bedankt"...): a comma-separated list per language. */
export function isStopPhrase(said: string, phrases: string): boolean {
  const clean = (s: string) => s.toLowerCase().replace(/[.,!?;:'’"]/g, "").replace(/\s+/g, " ").trim();
  const words = clean(said).split(" ");
  // The whole utterance is the phrase, give or take one word ("oké bedankt"),
  // so a real question like "stop met blaffen" doesn't end the conversation.
  return phrases.split(",").map(clean).filter(Boolean).some((p) => {
    const pw = p.split(" ");
    if (words.length > pw.length + 1) return false;
    for (let i = 0; i + pw.length <= words.length; i++) if (pw.every((w, j) => words[i + j] === w)) return true;
    return false;
  });
}
