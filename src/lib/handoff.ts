// A question to send as soon as AI help opens, handed over in memory by the
// walkthrough. Deliberately not a link parameter: a link from outside the app
// (snuffel:///ask?q=...) only fills in the question and never sends it.
let pending: { q: string; dog: number | null } | null = null;

export function sendOnOpen(q: string, dog: number | null) { pending = { q, dog }; }

/** The waiting question for this dog (or for no dog), once. */
export function takeQuestion(dog: number | null): string | null {
  if (!pending || (pending.dog != null && pending.dog !== dog)) return null;
  const q = pending.q;
  pending = null;
  return q;
}
