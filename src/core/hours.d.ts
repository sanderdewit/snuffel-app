// Types for hours.js (shared with the website and snuffel-data; do not edit the .js here).
export interface OpenState { open: boolean | null; always: boolean }
export type Moment = Date | { day: number; minutes: number } | null;
export function evaluate(str: string | null | undefined, now?: Moment, tz?: string): OpenState | null;
/** days[d] (0 = Sunday): [start, end] in minutes past midnight; an end at or before the start, or past 1440, runs into the next day. complete: every rule understood, so an empty day is closed (else unknown). */
export type Week = { always: true } | { always?: undefined; days: [number, number][][]; complete: boolean };
export function week(str: string | null | undefined): Week | null;
/** When it next closes (open: true) or opens (open: false); null when that can't be told safely. */
export interface Change { open: boolean; at: { day: number; minutes: number; daysAhead: number } }
export function nextChange(str: string | null | undefined, now?: Moment, tz?: string): Change | null;
export function tzFor(cc: string | null | undefined, lat?: number, lon?: number): string | undefined;
