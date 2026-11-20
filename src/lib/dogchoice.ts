// Which dog an AI chat is about: one of the owner's dogs, or no specific dog (null).
// No app imports, so tests/dogchoice.test.ts runs in plain Node.

export interface DogOption { id: number | null; name: string }

/** The chat header's choices: every dog, then "no specific dog". */
export function chatDogOptions(dogs: { id: number; name: string }[], noDog: string): DogOption[] {
  return [...dogs.map((d) => ({ id: d.id, name: d.name })), { id: null, name: noDog }];
}

/** "Is this about another dog?": every other dog, then "no specific dog". */
export function otherDogOptions(dogs: { id: number; name: string }[], current: number | null, noDog: string): DogOption[] {
  return chatDogOptions(dogs, noDog).filter((o) => o.id !== current);
}

// The owner's last choice, kept on the phone: a dog's id, or NO_DOG for "no specific
// dog". Nothing stored = never chosen.
export const NO_DOG = "none";
export const storedDog = (id: number | null): string => (id == null ? NO_DOG : String(id));

/**
 * The dog the chat opens with: one asked for by a link, else the current one, else the
 * last choice (also "no specific dog"), else, for an owner who never chose, the only dog.
 */
export function openingDog(dogs: { id: number }[], link: number | null, current: number | null, stored: string | null): number | null {
  const has = (id: number | null) => id != null && dogs.some((d) => d.id === id);
  if (has(link)) return link;
  if (has(current)) return current;
  if (stored === NO_DOG) return null;
  const last = stored ? Number(stored) : null;
  if (has(last)) return last;
  return dogs.length === 1 ? dogs[0].id : null;
}

/** The owner's latest question, ready to send again in the other dog's chat. */
export function lastQuestion(messages: { role: string; content: string; local?: boolean }[]): string {
  for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === "user" && !messages[i].local) return messages[i].content;
  return "";
}
