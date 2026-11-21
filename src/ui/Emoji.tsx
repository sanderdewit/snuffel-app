// An emoji that stays visible in dark mode. Emoji keep their own colours, and many
// are drawn in black or dark grey (🩺 vet, 🎓 training, 🐾 shelter and the paw by
// the app's name): on the dark surfaces they all but disappear. In dark mode such an
// emoji sits on a light disc (C.glyphBg, or the category's C.catDisc for a category),
// so it reads as it does in light mode. In light mode it is drawn as before: plain,
// or on its disc where it always had one (`always`: the place cards).
//
// Decoration only: the text next to it says what it is, so screen readers skip it.
import { Text, View, type StyleProp, type ViewStyle } from "react-native";
import type { Category } from "../core/classify";
import { CATEGORIES } from "../lib/places";
import { Symbol } from "./Icon";
import { useTheme } from "./theme";

interface EmojiProps {
  char: string;
  size: number;                    // font size when drawn plain (light mode)
  box: number;                     // the disc's diameter; the emoji on it is half as big
  bg?: string;                     // the disc's colour (default C.glyphBg)
  always?: boolean;                // on its disc in light mode too
  style?: StyleProp<ViewStyle>;    // for the disc, e.g. a negative margin so a chip keeps its height
}

const hidden = { accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" as const };

export function Emoji({ char, size, box, bg, always, style }: EmojiProps) {
  const { scheme, C } = useTheme();
  if (scheme === "light" && !always) return <Text style={{ fontSize: size }} {...hidden}>{char}</Text>;
  return (
    <View style={[{ width: box, height: box, borderRadius: box / 2, backgroundColor: bg ?? C.glyphBg, alignItems: "center", justifyContent: "center" }, style]} {...hidden}>
      <Text style={{ fontSize: Math.round(box / 2) }}>{char}</Text>
    </View>
  );
}

/**
 * A category's icon on the category's disc: a line symbol in a deep shade of the
 * category's hue (catInk) on a light tint of it (catDisc), in both schemes. The hue
 * matches the category's map marker and its dot on the Find chips.
 * `size` is kept for the old emoji call sites; the symbol is half the disc.
 */
export function CategoryIcon({ cat, box, style }: { cat: Category } & Omit<EmojiProps, "char" | "bg">) {
  const { C } = useTheme();
  return (
    <View style={[{ width: box, height: box, borderRadius: box / 2, backgroundColor: C.catDisc[cat], alignItems: "center", justifyContent: "center" }, style]} {...hidden}>
      <Symbol name={CATEGORIES[cat].symbol} size={Math.round(box * 0.55)} color={C.catInk[cat]} />
    </View>
  );
}
