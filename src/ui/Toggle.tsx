// On/off toggle in the app's colours (used instead of the platform Switch).
import { Pressable, View } from "react-native";
import { C } from "./theme";

export function Toggle({ value, onValueChange, label }: { value: boolean; onValueChange: (v: boolean) => void; label?: string }) {
  return (
    <Pressable onPress={() => onValueChange(!value)} hitSlop={8} accessibilityRole="switch" accessibilityState={{ checked: value }} accessibilityLabel={label}
      style={{ width: 50, height: 30, borderRadius: 15, padding: 3, backgroundColor: value ? C.ok : "#cbd5e1", justifyContent: "center" }}>
      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "#fff", alignSelf: value ? "flex-end" : "flex-start",
        shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2 }} />
    </Pressable>
  );
}
