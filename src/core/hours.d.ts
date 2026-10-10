// Types for hours.js (shared with the website and snuffel-data; do not edit the .js here).
export interface OpenState { open: boolean | null; always: boolean }
export function evaluate(str: string | null | undefined, now?: Date | { day: number; minutes: number } | null, tz?: string): OpenState | null;
export function tzFor(cc: string | null | undefined, lat?: number, lon?: number): string | undefined;
