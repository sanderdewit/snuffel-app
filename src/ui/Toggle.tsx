// On/off toggle in the app's colours (used instead of the platform Switch).
// The knob is white and its shadow black in light and dark, as the platform's own switches.
//
// A switch needs a name for screen readers ("Independents only, switch, on"): pass
// `label`, or use ToggleRow, where the label is shown and the whole row toggles.
import type { ReactNode } from "react";
import { Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "./theme";

function Track({ value }: { value: boolean }) {
  const { C } = useTheme();
  return (
    <View style={{ width: 50, height: 30, borderRadius: 15, padding: 3, backgroundColor: value ? C.toggleOn : C.toggleOff, justifyContent: "center" }}>
      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "#fff", alignSelf: value ? "flex-end" : "flex-start",
        shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2 }} />
    </View>
  );
}

/** The switch alone (its tap area is 46 x 66 px). Pass `label` when no ToggleRow is used. */
export function Toggle({ value, onValueChange, label }: { value: boolean; onValueChange: (v: boolean) => void; label?: string }) {
  const { S } = useTheme();
  return (
    <Pressable onPress={() => onValueChange(!value)} hitSlop={8} accessibilityRole="switch" accessibilityState={{ checked: value }} accessibilityLabel={label}
      style={({ pressed }) => pressed && S.pressed}>
      <Track value={value} />
    </Pressable>
  );
}

/**
 * A labelled switch: the label (and optional `detail` under it) on the left, the switch
 * on the right; the whole row is one target of 44 px or more, read as "<label>, switch, on".
 */
export function ToggleRow({ value, onValueChange, label, detail, bold, icon, style }: {
  value: boolean; onValueChange: (v: boolean) => void; label: string;
  detail?: string; bold?: boolean; icon?: ReactNode; style?: StyleProp<ViewStyle>;
}) {
  const { S } = useTheme();
  return (
    <Pressable onPress={() => onValueChange(!value)} accessibilityRole="switch" accessibilityState={{ checked: value }}
      accessibilityLabel={label} accessibilityHint={detail}
      style={({ pressed }) => [S.row, { gap: 12, minHeight: 44 }, pressed && S.pressed, style]}>
      {icon}
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[S.body, bold && { fontWeight: "700" }]}>{label}</Text>
        {!!detail && <Text style={S.muted}>{detail}</Text>}
      </View>
      <Track value={value} />
    </Pressable>
  );
}
