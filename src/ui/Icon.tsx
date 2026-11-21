// The app's icons: one line-icon set (Feather) for actions, navigation and states,
// and a few dog-specific symbols (paw, stethoscope, the place categories) from
// Material Community Icons. Unlike emoji they take the theme's colours (light and
// dark, selected or not), look the same on iOS and Android, and screen readers
// skip them: the text next to an icon says what it is. An icon-only button passes
// `label`, which becomes the accessibility label of the icon (the button itself
// should carry the same label).
// Both fonts are built into the app (expo-font plugin in app.json), so they never flash.
import type { ComponentProps } from "react";
import type { StyleProp, TextStyle } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useTheme } from "./theme";

export type IconName = ComponentProps<typeof Feather>["name"];
export type SymbolName = ComponentProps<typeof MaterialCommunityIcons>["name"];

interface Common { size?: number; color?: string; label?: string; style?: StyleProp<TextStyle> }

const a11y = (label?: string) => (label
  ? { accessible: true, accessibilityRole: "image" as const, accessibilityLabel: label }
  : { accessible: false, accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" as const });

/** A line icon (Feather), in the text colour unless `color` says otherwise. */
export function Icon({ name, size = 20, color, label, style }: Common & { name: IconName }) {
  const { C } = useTheme();
  return <Feather name={name} size={size} color={color ?? C.text} style={style} {...a11y(label)} />;
}

/** A dog-specific symbol (Material Community Icons): paw, stethoscope, the categories. */
export function Symbol({ name, size = 20, color, label, style }: Common & { name: SymbolName }) {
  const { C } = useTheme();
  return <MaterialCommunityIcons name={name} size={size} color={color ?? C.text} style={style} {...a11y(label)} />;
}
