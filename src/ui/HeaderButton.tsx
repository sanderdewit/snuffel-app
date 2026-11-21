// A button in the navigation header: a word ("Edit"), or an icon that carries the
// same word as its label (the PDF export). At least 44 x 44, in the link colour,
// dimmed while held; a spinner while busy.
import { ActivityIndicator, Pressable, Text } from "react-native";
import { Icon, type IconName } from "./Icon";
import { useTheme } from "./theme";

export function HeaderButton({ label, icon, onPress, disabled, busy }: { label: string; icon?: IconName; onPress: () => void; disabled?: boolean; busy?: boolean }) {
  const { C, S } = useTheme();
  const off = !!(disabled || busy);
  return (
    <Pressable onPress={onPress} disabled={off} hitSlop={4} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: off, busy: !!busy }}
      style={({ pressed }) => [{ minWidth: 44, minHeight: 44, paddingHorizontal: icon ? 0 : 6, alignItems: "center", justifyContent: "center" }, (pressed || (disabled && !busy)) && S.pressed]}>
      {busy ? <ActivityIndicator color={C.link} />
        : icon ? <Icon name={icon} size={22} color={C.link} />
        : <Text style={{ color: C.link, fontSize: 17, fontWeight: "600" }}>{label}</Text>}
    </Pressable>
  );
}
