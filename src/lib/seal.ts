// Password protection for exported dog files: AES-256-GCM with a key from
// scrypt (audited @noble libraries, pure JS), plus the checks on imported
// files. No app imports, so tests/dogfile.test.ts runs in plain Node.
import { gcm } from "@noble/ciphers/aes.js";
import { bytesToUtf8, utf8ToBytes } from "@noble/ciphers/utils.js";
import { scryptAsync } from "@noble/hashes/scrypt.js";

export interface Sealed { format: "snuffel-dog-encrypted"; version: 1; kdf: "scrypt"; N: number; r: number; p: number; salt: string; nonce: string; data: string }
export const SCRYPT = { N: 2 ** 16, r: 8, p: 1 };   // 64 MiB, a few seconds on a phone
// The only work factors a file may ask for: today's, and 2^14 from older exports.
// Anything else is a crafted file (memory = 128 * N * r bytes).
const ACCEPTED = [{ N: 2 ** 14, r: 8, p: 1 }, SCRYPT];
export const PASSWORD_MIN = 10;   // characters, counted as typed

const b64enc = (u: Uint8Array) => { let s = ""; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); };
export const b64dec = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export const b64 = { enc: b64enc, dec: b64dec };

const keyFrom = (password: string, salt: Uint8Array, p: { N: number; r: number; p: number }) =>
  scryptAsync(utf8ToBytes(typeof password.normalize === "function" ? password.normalize("NFKC") : password), salt, { N: p.N, r: p.r, p: p.p, dkLen: 32 });

export class PasswordTooShortError extends Error {}

export async function seal(plain: string, password: string, random: (n: number) => Uint8Array): Promise<Sealed> {
  if (password.length < PASSWORD_MIN) throw new PasswordTooShortError();
  const salt = random(16), nonce = random(12);
  const key = await keyFrom(password, salt, SCRYPT);
  const data = gcm(key, nonce).encrypt(utf8ToBytes(plain));
  return { format: "snuffel-dog-encrypted", version: 1, kdf: "scrypt", ...SCRYPT, salt: b64enc(salt), nonce: b64enc(nonce), data: b64enc(data) };
}

export class WrongPasswordError extends Error {}
export class BadSealError extends Error {}

/** True when the file asks for one of the work factors this app writes. */
export const acceptedParams = (s: Partial<Sealed>) => ACCEPTED.some((a) => s.N === a.N && s.r === a.r && s.p === a.p);

/** The plain text; BadSealError for unknown work factors, WrongPasswordError for a wrong password or a damaged file (GCM can't tell them apart). */
export async function unseal(s: Sealed, password: string): Promise<string> {
  if (!acceptedParams(s)) throw new BadSealError();
  try {
    const key = await keyFrom(password, b64dec(s.salt), s);
    return bytesToUtf8(gcm(key, b64dec(s.nonce)).decrypt(b64dec(s.data)));
  } catch { throw new WrongPasswordError(); }
}

// ---- import checks ----
export const IMPORT_MAX_BYTES = 10 * 1024 * 1024;

/** "jpg" or "png" by the file's magic bytes, otherwise null. */
export function imageType(u: Uint8Array): "jpg" | "png" | null {
  if (u.length > 3 && u[0] === 0xff && u[1] === 0xd8 && u[2] === 0xff) return "jpg";
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (u.length > png.length && png.every((b, i) => u[i] === b)) return "png";
  return null;
}
