// A dog's photo, or (no photo yet) the first letter of its name on a soft orange
// disc: the link colour on noteBg, 4.9:1 in light and 6.9:1 in dark. Decoration only:
// the name is always written next to it.
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Symbol } from "./Icon";
import { useTheme } from "./theme";

const hidden = { accessible: false, accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" as const };

export function DogAvatar({ name, photo, size }: { name: string; photo: string | null; size: number }) {
  const { C } = useTheme();
  const round = { width: size, height: size, borderRadius: size / 2 };
  if (photo) return <Image source={{ uri: photo }} style={round} {...hidden} />;
  const first = Array.from(name.trim())[0];
  return (
    <View style={[round, { backgroundColor: C.noteBg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, alignItems: "center", justifyContent: "center" }]} {...hidden}>
      {first
        ? <Text style={{ color: C.link, fontSize: Math.round(size * 0.4), fontWeight: "700" }} allowFontScaling={false}>{first.toLocaleUpperCase()}</Text>
        : <Symbol name="dog" size={Math.round(size * 0.5)} color={C.link} />}
    </View>
  );
}
