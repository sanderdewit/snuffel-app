// The breed field of a dog profile: a searchable list of breeds in the app's language
// (common European breeds first; accents, other languages' names and small typos
// are found too). "Mixed breed" asks for the size and optionally the main breeds,
// "Other breed" for the owner's own words.
import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useI18n } from "../i18n";
import { breedLabel, breedName, breeds, MIX_MAX, MIX_SIZES, searchBreeds, type Breed, type BreedChoice } from "../lib/breeds";
import { Input } from "./Input";
import { useTheme } from "./theme";

export const NO_BREED: BreedChoice = { breedId: null, breed: null, breedSize: null, breedMix: [] };

type Row = { key: string; header: string } | { key: string; breed: Breed };

/** The list itself, full screen. `exclude`: ids not offered (the "mainly" choice offers no mixed/other). */
function BreedList({ visible, onPick, onClose, exclude }: { visible: boolean; onPick: (b: Breed) => void; onClose: () => void; exclude?: string[] }) {
  const { t, lang } = useI18n();
  const { C, S } = useTheme();
  const [query, setQuery] = useState("");
  const rows = useMemo<Row[]>(() => {
    if (!visible) return [];
    const found = searchBreeds(breeds(), query, lang, { exclude, limit: query.trim() ? 50 : undefined });
    if (query.trim()) return found.map((b) => ({ key: b.id, breed: b }));
    const out: Row[] = [];
    const common = found.filter((b) => b.rank);
    if (common.length) out.push({ key: "h-common", header: t("app_breedCommon") }, ...common.map((b) => ({ key: b.id, breed: b })));
    out.push({ key: "h-all", header: t("app_breedAll") }, ...found.filter((b) => !b.rank).map((b) => ({ key: b.id, breed: b })));
    return out;
  }, [visible, query, lang, exclude, t]);
  const close = () => { setQuery(""); onClose(); };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <SafeAreaView style={S.screen} edges={["top", "bottom"]}>
        <View style={[S.row, { gap: 8, padding: 12, borderBottomWidth: 1, borderColor: C.line, backgroundColor: C.card }]}>
          <Input style={[S.input, { flex: 1 }]} value={query} onChangeText={setQuery} placeholder={t("app_breedSearch")}
            autoFocus autoCorrect={false} autoCapitalize="none" returnKeyType="search" clearButtonMode="while-editing" accessibilityLabel={t("app_breedSearch")} />
          <Pressable onPress={close} style={S.btnGhost} accessibilityRole="button">
            <Text style={S.btnGhostText}>{t("app_cancel")}</Text>
          </Pressable>
        </View>
        <FlatList
          data={rows}
          keyExtractor={(r) => r.key}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          initialNumToRender={30}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item }) => "header" in item ? (
            <Text style={[S.muted, { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4, fontWeight: "700" }]}>{item.header}</Text>
          ) : (
            <Pressable onPress={() => { setQuery(""); onPick(item.breed); }} accessibilityRole="button"
              style={({ pressed }) => ({ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: C.line, backgroundColor: pressed ? C.chip : C.card })}>
              <Text style={[S.body, item.breed.kind === "mixed" || item.breed.kind === "other" ? { fontWeight: "700" } : null]}>
                {item.breed.names[lang] || item.breed.names.en}
              </Text>
              {/* the English name helps when the own-language name is unfamiliar (or a fallback) */}
              {lang !== "en" && item.breed.names.en !== (item.breed.names[lang] || item.breed.names.en) && item.breed.kind !== "mixed" && item.breed.kind !== "other" && (
                <Text style={S.muted}>{item.breed.names.en}</Text>
              )}
            </Pressable>
          )}
          ListFooterComponent={query.trim() ? <Text style={[S.muted, { padding: 16 }]}>{t("app_breedNotFound")}</Text> : undefined}
        />
      </SafeAreaView>
    </Modal>
  );
}

export function BreedPicker({ value, onChange }: { value: BreedChoice; onChange: (c: BreedChoice) => void }) {
  const { t, tf, lang } = useI18n();
  const { C, S } = useTheme();
  const [open, setOpen] = useState<"breed" | "mainly" | null>(null);
  const mainlyExclude = useMemo(() => ["mixed", "other", ...value.breedMix], [value.breedMix]);
  const label = breedLabel(breeds(), value, lang, t, tf);
  const isMixed = value.breedId === "mixed", isOther = value.breedId === "other";

  const pick = (b: Breed) => {
    if (open === "mainly") {
      if (!value.breedMix.includes(b.id)) onChange({ ...value, breedMix: [...value.breedMix, b.id].slice(0, MIX_MAX) });
    } else if (b.id !== value.breedId) {
      // a new choice starts clean; "other" keeps the old free text to edit
      onChange({ breedId: b.id, breed: b.id === "other" ? value.breed : null, breedSize: null, breedMix: [] });
    }
    setOpen(null);
  };
  const chip = (on: boolean) => [S.btnGhost, { paddingVertical: 8, backgroundColor: on ? C.brand : C.chip }];
  const chipText = (on: boolean) => [S.btnGhostText, { color: on ? C.onBrand : C.text }];

  return (
    <View style={{ gap: 8 }}>
      <Pressable onPress={() => setOpen("breed")} accessibilityRole="button" accessibilityLabel={t("app_breed")}
        style={[S.input, S.row, { justifyContent: "space-between", gap: 8 }]}>
        <Text style={{ flex: 1, fontSize: 16, color: value.breedId || value.breed ? C.text : C.muted }} numberOfLines={2}>
          {(isMixed ? breedName(breeds(), "mixed", lang) : label) || t("app_breedChoose")}
        </Text>
        <Text style={{ color: C.muted, fontSize: 18 }}>›</Text>
      </Pressable>

      {isOther && (
        <Input style={S.input} value={value.breed || ""} onChangeText={(s) => onChange({ ...value, breed: s })} maxLength={40}
          placeholder={t("app_breedOtherText")} accessibilityLabel={t("app_breedOtherText")} />
      )}

      {isMixed && (
        <View style={{ gap: 8 }}>
          <Text style={S.muted}>{t("app_breedSize")}</Text>
          <View style={[S.row, { gap: 8 }]}>
            {MIX_SIZES.map((s) => (
              <Pressable key={s} style={[chip(value.breedSize === s), { flex: 1 }]} accessibilityRole="button" accessibilityState={{ selected: value.breedSize === s }}
                onPress={() => onChange({ ...value, breedSize: value.breedSize === s ? null : s })}>
                <Text style={chipText(value.breedSize === s)}>{t("app_size_" + s)}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={S.muted}>{t("app_breedSizeHint")}</Text>
          <Text style={S.muted}>{t("app_breedMainly")}</Text>
          <View style={[S.row, { gap: 8, flexWrap: "wrap" }]}>
            {value.breedMix.map((id) => (
              <Pressable key={id} style={chip(true)} accessibilityRole="button" accessibilityLabel={`${breedName(breeds(), id, lang)}, ${t("app_remove")}`}
                onPress={() => onChange({ ...value, breedMix: value.breedMix.filter((m) => m !== id) })}>
                <Text style={chipText(true)}>{breedName(breeds(), id, lang)}  ✕</Text>
              </Pressable>
            ))}
            {value.breedMix.length < MIX_MAX && (
              <Pressable style={chip(false)} onPress={() => setOpen("mainly")} accessibilityRole="button">
                <Text style={chipText(false)}>＋ {t("app_breedMainlyAdd")}</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {(value.breedId || value.breed) && (
        <Pressable onPress={() => onChange(NO_BREED)} style={{ alignSelf: "flex-start" }} accessibilityRole="button">
          <Text style={[S.muted, { color: C.link }]}>{t("app_remove")}</Text>
        </Pressable>
      )}

      <BreedList visible={open !== null} onClose={() => setOpen(null)} onPick={pick}
        exclude={open === "mainly" ? mainlyExclude : undefined} />
    </View>
  );
}
