// The icon of each kind of entry in the health file: a line icon, or a symbol where
// Feather has none (stethoscope, pill, scale, paw). The same meaning as the emoji they
// replace. Decoration only: the kind's name is always written next to it.
import { View } from "react-native";
import type { RecordKind } from "../lib/dogsummary";
import { Icon, Symbol, type IconName, type SymbolName } from "./Icon";
import { useTheme } from "./theme";

const ICONS: Record<RecordKind, { icon: IconName } | { symbol: SymbolName }> = {
  symptom: { icon: "thermometer" },
  visit: { symbol: "stethoscope" },
  diagnosis: { icon: "clipboard" },
  medication: { symbol: "pill" },
  allergy: { icon: "alert-triangle" },
  weight: { symbol: "scale-balance" },
  behaviour: { symbol: "paw" },
  note: { icon: "edit-3" },
  ai: { icon: "message-circle" }
};

export function RecordIcon({ kind, size = 18, color }: { kind: RecordKind; size?: number; color?: string }) {
  const i = ICONS[kind] ?? ICONS.note;
  return "icon" in i ? <Icon name={i.icon} size={size} color={color} /> : <Symbol name={i.symbol} size={size} color={color} />;
}

/** The kind's icon on a round disc, as in the list of entries: muted on the chip colour (5:1 or more in both schemes). */
export function RecordDisc({ kind, box = 36 }: { kind: RecordKind; box?: number }) {
  const { C } = useTheme();
  return (
    <View style={{ width: box, height: box, borderRadius: box / 2, backgroundColor: C.chip, alignItems: "center", justifyContent: "center" }}
      accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <RecordIcon kind={kind} size={Math.round(box * 0.5)} color={C.muted} />
    </View>
  );
}
