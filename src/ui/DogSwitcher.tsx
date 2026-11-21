// Which dog the AI chat is about, in the chat's header: the owner's dogs plus
// "No specific dog". One dog: two chips, no list. More dogs: the chosen dog,
// tap to open the list. Nothing without dogs.
import { useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { useI18n } from "../i18n";
import { chatDogOptions, type DogOption } from "../lib/dogchoice";
import { useTheme } from "./theme";

const label = (o: DogOption) => (o.id != null ? "🐕 " : "") + o.name;

/** Dogs as chips: a choice (radio) with `value`, or plain buttons without (the "another dog?" hint); children go last. */
export function DogChips({ options, value, onChange, children }: { options: DogOption[]; value?: number | null; onChange: (id: number | null) => void; children?: ReactNode }) {
  const { C, S } = useTheme();
  const choice = value !== undefined;
  return (
    <View style={[S.row, { gap: 6, flexWrap: "wrap", flexShrink: 1 }]} accessibilityRole={choice ? "radiogroup" : undefined}>
      {options.map((o) => {
        const on = choice && o.id === value;
        return (
          <Pressable key={String(o.id)} onPress={() => onChange(o.id)} accessibilityRole={choice ? "radio" : "button"} accessibilityState={choice ? { checked: on } : undefined}
            style={{ minHeight: 40, justifyContent: "center", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16,
              backgroundColor: on ? C.brandDark : C.card, borderWidth: 1, borderColor: on ? C.brandDark : C.line }}>
            <Text style={{ color: on ? C.onBrand : C.text, fontWeight: on ? "600" : "400" }}>{label(o)}</Text>
          </Pressable>
        );
      })}
      {children}
    </View>
  );
}

export function DogSwitcher({ dogs, value, onChange }: { dogs: { id: number; name: string }[]; value: number | null; onChange: (id: number | null) => void }) {
  const { t } = useI18n();
  const { C, S } = useTheme();
  const [open, setOpen] = useState(false);
  if (!dogs.length) return null;
  const options = chatDogOptions(dogs, t("app_noDog"));
  const title = t("app_askFor").replace(/\s*:\s*$/, "");   // some languages end it with a colon
  if (dogs.length === 1) {
    return (
      <View style={[S.row, { gap: 8, flexWrap: "wrap" }]}>
        <Text style={S.muted}>{title}:</Text>
        <DogChips options={options} value={value} onChange={onChange} />
      </View>
    );
  }
  const current = options.find((o) => o.id === value) || options[options.length - 1];
  const pick = (id: number | null) => { setOpen(false); if (id !== value) onChange(id); };
  return (
    <View style={{ gap: 8 }}>
      <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }}
        accessibilityLabel={`${title}: ${current.name}`} accessibilityHint={t("app_changeDog")}
        style={[S.row, { gap: 8, minHeight: 40, flexWrap: "wrap" }]}>
        <Text style={S.muted}>{title}:</Text>
        <View style={[S.row, { gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: C.brandDark }]}>
          <Text style={{ color: C.onBrand, fontWeight: "600" }}>{label(current)}</Text>
          <Text style={{ color: C.onBrand }}>{open ? "▴" : "▾"}</Text>
        </View>
      </Pressable>
      {open && (
        <View style={[S.card, { paddingVertical: 4, paddingHorizontal: 0 }]} accessibilityRole="radiogroup" accessibilityLabel={t("app_changeDog")}>
          {options.map((o, n) => {
            const on = o.id === value;
            return (
              <Pressable key={String(o.id)} onPress={() => pick(o.id)} accessibilityRole="radio" accessibilityState={{ checked: on }}
                style={[S.row, { minHeight: 44, paddingHorizontal: 14, gap: 8, borderTopWidth: n ? 1 : 0, borderColor: C.line }]}>
                <Text style={[S.body, { flex: 1, fontWeight: on ? "700" : "400" }]}>{label(o)}</Text>
                {on && <Text style={{ color: C.link, fontWeight: "700" }}>✓</Text>}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
