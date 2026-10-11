// Password protection for exported dog files: AES-256-GCM with a key from
// scrypt (audited @noble libraries, pure JS). No app imports, so
// tests/seal.test.ts runs in plain Node.
import { gcm } from "@noble/ciphers/aes.js";
import { bytesToUtf8, utf8ToBytes } from "@noble/ciphers/utils.js";
import { scryptAsync } from "@noble/hashes/scrypt.js";

export interface Sealed { format: "snuffel-dog-encrypted"; version: 1; kdf: "scrypt"; N: number; r: number; p: number; salt: string; nonce: string; data: string }
export const SCRYPT = { N: 2 ** 14, r: 8, p: 1 };   // ~1-3 s on a phone

const b64enc = (u: Uint8Array) => { let s = ""; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); };
export const b64dec = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export const b64 = { enc: b64enc, dec: b64dec };

const keyFrom = (password: string, salt: Uint8Array, p: { N: number; r: number; p: number }) =>
  scryptAsync(utf8ToBytes(password.normalize("NFKC")), salt, { N: p.N, r: p.r, p: p.p, dkLen: 32 });

export async function seal(plain: string, password: string, random: (n: number) => Uint8Array): Promise<Sealed> {
  const salt = random(16), nonce = random(12);
  const key = await keyFrom(password, salt, SCRYPT);
  const data = gcm(key, nonce).encrypt(utf8ToBytes(plain));
  return { format: "snuffel-dog-encrypted", version: 1, kdf: "scrypt", ...SCRYPT, salt: b64enc(salt), nonce: b64enc(nonce), data: b64enc(data) };
}

export class WrongPasswordError extends Error {}

/** The plain text, or WrongPasswordError (wrong password or a damaged file: GCM can't tell them apart). */
export async function unseal(s: Sealed, password: string): Promise<string> {
  // Refuse absurd work factors from a crafted file (memory = 128 * N * r bytes).
  if (!(s.N >= 1024 && s.N <= 2 ** 18 && s.r >= 1 && s.r <= 16 && s.p >= 1 && s.p <= 4)) throw new WrongPasswordError();
  try {
    const key = await keyFrom(password, b64dec(s.salt), s);
    return bytesToUtf8(gcm(key, b64dec(s.nonce)).decrypt(b64dec(s.data)));
  } catch { throw new WrongPasswordError(); }
}
