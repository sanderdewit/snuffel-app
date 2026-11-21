// Which dog the AI chat is about, in the chat's header: the owner's dogs plus
// "No specific dog". The chosen dog is one chip (its initial on an orange disc, the
// name, a chevron); a tap opens the list under the header row. Whatever else belongs
// in that row (the health-file switch) comes in as children, after the chip.
// Nothing without dogs.
import { useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { useI18n } from "../i18n";
import { chatDogOptions, type DogOption } from "../lib/dogchoice";
import { Icon, Symbol } from "./Icon";
import { useTheme } from "./theme";

/** The dog's initial on a disc; "No specific dog" gets none. */
function Initial({ option, size }: { option: DogOption; size: number }) {
  const { C } = useTheme();
  if (option.id == null) return null;
  const letter = (Array.from(option.name.trim())[0] || "?").toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.brandDark, alignItems: "center", justifyContent: "center" }}
      accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Text style={{ color: C.onBrand, fontWeight: "700", fontSize: Math.round(size * 0.45) }}>{letter}</Text>
    </View>
  );
}

/** Dogs as chips: a choice (radio) with `value`, or plain buttons without (the "another dog?" hint); children go last. */
export function DogChips({ options, value, onChange, children }: { options: DogOption[]; value?: number | null; onChange: (id: number | null) => void; children?: ReactNode }) {
  const { C, S } = useTheme();
  const choice = value !== undefined;
  return (
    <View style={[S.row, { gap: 6, flexWrap: "wrap", flexShrink: 1 }]} accessibilityRole={choice ? "radiogroup" : undefined}>
      {options.map((o) => {
        const on = choice && o.id === value;
        return (
          <Pressable key={String(o.id)} onPress={() => onChange(o.id)} accessibilityRole={choice ? "radio" : "button"}
            accessibilityState={choice ? { checked: on } : undefined}
            style={({ pressed }) => [S.row, { gap: 6, minHeight: 44, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 22,
              backgroundColor: on ? C.brandDark : C.card, borderWidth: 1, borderColor: on ? C.brandDark : C.line }, pressed && S.pressed]}>
            {o.id != null && <Symbol name="dog" size={18} color={on ? C.onBrand : C.muted} />}
            <Text style={{ color: on ? C.onBrand : C.text, fontWeight: on ? "600" : "400" }}>{o.name}</Text>
          </Pressable>
        );
      })}
      {children}
    </View>
  );
}

export function DogSwitcher({ dogs, value, onChange, children }: {
  dogs: { id: number; name: string }[]; value: number | null; onChange: (id: number | null) => void; children?: ReactNode;
}) {
  const { t } = useI18n();
  const { C, S } = useTheme();
  const [open, setOpen] = useState(false);
  if (!dogs.length) return null;
  const options = chatDogOptions(dogs, t("app_noDog"));
  const title = t("app_askFor").replace(/\s*:\s*$/, "");   // some languages end it with a colon
  const current = options.find((o) => o.id === value) || options[options.length - 1];
  const pick = (id: number | null) => { setOpen(false); if (id !== value) onChange(id); };
  return (
    <View style={{ gap: 8 }}>
      {/* One row: the chip takes what it needs (a long name ends in "…"), the rest goes to the children */}
      <View style={[S.row, { gap: 10 }]}>
        <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }}
          accessibilityLabel={`${title}: ${current.name}`} accessibilityHint={t("app_changeDog")}
          style={({ pressed }) => [S.row, { gap: 8, minHeight: 44, flexShrink: 1, maxWidth: children ? "58%" : "100%", paddingLeft: current.id != null ? 4 : 12, paddingRight: 10,
            borderRadius: 22, borderWidth: 1, borderColor: C.line, backgroundColor: C.chip }, pressed && S.pressed]}>
          <Initial option={current} size={34} />
          <Text style={{ flexShrink: 1, color: C.text, fontSize: 15, fontWeight: "600" }} numberOfLines={1}>{current.name}</Text>
          <Icon name={open ? "chevron-up" : "chevron-down"} size={18} />
        </Pressable>
        {children}
      </View>
      {open && (
        <View style={[S.card, { paddingVertical: 4, paddingHorizontal: 0 }]} accessibilityRole="radiogroup" accessibilityLabel={t("app_changeDog")}>
          {options.map((o, n) => {
            const on = o.id === value;
            return (
              <Pressable key={String(o.id)} onPress={() => pick(o.id)} accessibilityRole="radio" accessibilityState={{ checked: on }}
                style={({ pressed }) => [S.row, { minHeight: 48, paddingHorizontal: 14, gap: 10, borderTopWidth: n ? 1 : 0, borderColor: C.line }, pressed && S.pressed]}>
                {o.id != null ? <Initial option={o} size={28} /> : <View style={{ width: 28 }} />}
                <Text style={[S.body, { flex: 1, fontWeight: on ? "700" : "400" }]}>{o.name}</Text>
                {on && <Icon name="check" size={20} color={C.link} />}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
