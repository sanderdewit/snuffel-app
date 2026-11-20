// Run with:  node tests/dogchoice.test.ts
// Which dog the AI chat is about: the header's choices and "Is this about another dog?".
import assert from "node:assert";
import { chatDogOptions, lastQuestion, NO_DOG, openingDog, otherDogOptions, storedDog } from "../src/lib/dogchoice.ts";

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log("  ok  " + name); }
  catch (e) { failed++; console.log("  FAIL " + name + "\n       " + (e as Error).message); }
}
const dogs = [{ id: 1, name: "Zeus" }, { id: 2, name: "Briciola" }, { id: 5, name: "Fido" }];

console.log("dog choice in the chat");
test("the header offers every dog, then 'no specific dog'", () => {
  assert.deepStrictEqual(chatDogOptions(dogs, "No specific dog").map((o) => o.id), [1, 2, 5, null]);
  assert.deepStrictEqual(chatDogOptions([], "No specific dog"), [{ id: null, name: "No specific dog" }]);
});
test("another dog: the other dogs and 'no specific dog', never the chosen one", () => {
  assert.deepStrictEqual(otherDogOptions(dogs, 1, "-").map((o) => o.id), [2, 5, null]);
  assert.deepStrictEqual(otherDogOptions(dogs, 5, "-").map((o) => o.name), ["Zeus", "Briciola", "-"]);
  // One dog: only 'no specific dog' (the app adds "Add a dog").
  assert.deepStrictEqual(otherDogOptions([dogs[0]], 1, "-"), [{ id: null, name: "-" }]);
  // From the 'no specific dog' conversation ("Choose a dog"): just the dogs.
  assert.deepStrictEqual(otherDogOptions(dogs, null, "-").map((o) => o.id), [1, 2, 5]);
});
test("the opening dog: link, current, last choice ('no specific dog' too), the only dog only if never chosen", () => {
  const one = [dogs[0]];
  // One dog, never chosen: that dog. Chose "no specific dog": stays there when coming back.
  assert.strictEqual(openingDog(one, null, null, null), 1);
  assert.strictEqual(storedDog(null), NO_DOG);
  assert.strictEqual(openingDog(one, null, null, storedDog(null)), null);
  assert.strictEqual(openingDog(one, null, null, storedDog(1)), 1);
  // A link or the dog on screen comes first; a stored dog that was deleted falls back.
  assert.strictEqual(openingDog(dogs, 5, 2, NO_DOG), 5);
  assert.strictEqual(openingDog(dogs, null, 2, NO_DOG), 2);
  assert.strictEqual(openingDog(dogs, null, null, "2"), 2);
  assert.strictEqual(openingDog(dogs, 9, null, "9"), null);       // several dogs, never a guess
  assert.strictEqual(openingDog(one, null, 9, "9"), 1);
  assert.strictEqual(openingDog([], null, null, null), null);
});
test("the question carried over is the owner's latest one", () => {
  assert.strictEqual(lastQuestion([
    { role: "user", content: "Zeus heeft gebraakt" }, { role: "assistant", content: "..." },
    { role: "user", content: "Briciola eet niet" }, { role: "assistant", content: "...", local: true }
  ]), "Briciola eet niet");
  assert.strictEqual(lastQuestion([{ role: "assistant", content: "Hallo" }]), "");
  assert.strictEqual(lastQuestion([]), "");
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
