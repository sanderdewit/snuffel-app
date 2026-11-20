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

/** The owner's latest question, ready to send again in the other dog's chat. */
export function lastQuestion(messages: { role: string; content: string; local?: boolean }[]): string {
  for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === "user" && !messages[i].local) return messages[i].content;
  return "";
}
