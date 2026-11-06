// A random ID per app install (UUID v4), sent to Snuffel's API as
// X-Snuffel-Install: rate limits per install, since phones on mobile data often
// share one IP. It says nothing about the person; a reinstall gets a new one.
import * as Crypto from "expo-crypto";
import { kvGet, kvSet } from "./db";

export async function installId(): Promise<string> {
  let id = await kvGet("installId");
  if (!id) { id = Crypto.randomUUID(); await kvSet("installId", id); }
  return id;
}
