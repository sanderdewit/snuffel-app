// A dog's facts as short texts: "4 years", "Male, neutered".
import { ageMonths } from "../lib/dates";
import type { Dog } from "../lib/dogs";

type T = (key: string) => string;
type TF = (key: string, vars?: Record<string, string | number>) => string;

/** "8 months" under two years, then "4 years"; null without a (valid, past) birth date. */
export function ageText(d: Pick<Dog, "birth">, tf: TF): string | null {
  const m = ageMonths(d.birth);
  if (m == null) return null;
  return m < 24 ? tf("app_ageMonths", { n: m }) : tf("app_age", { n: Math.floor(m / 12) });
}

/** "Male", "Female, neutered" (one text per combination: the word agrees with the sex); null when not given. */
export function sexText(d: Pick<Dog, "sex" | "neutered">, t: T): string | null {
  if (d.sex === "male") return t(d.neutered ? "app_maleNeutered" : "app_male");
  if (d.sex === "female") return t(d.neutered ? "app_femaleNeutered" : "app_female");
  return null;
}
