// The app language, opened from Settings: a searchable list. Each language by its own
// name (as before), with its name in the current language under it where the phone
// knows it. "Phone language" follows the phone. Search finds the own name, the name
// in the current language, the English name and the code ("duits", "german", "de").
import { useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { LANGUAGES, phoneLanguage, useI18n } from "../i18n";
import { norm } from "../lib/breedsearch";
import { Icon } from "../ui/Icon";
import { Input } from "../ui/Input";
import { useTheme } from "../ui/theme";

// English names: found when typed in English, whatever the app language.
const ENGLISH: Record<string, string> = {
  bg: "Bulgarian", ca: "Catalan", cs: "Czech", da: "Danish", de: "German", el: "Greek", en: "English", es: "Spanish",
  et: "Estonian", fi: "Finnish", fr: "French", hr: "Croatian", hu: "Hungarian", is: "Icelandic", it: "Italian",
  lt: "Lithuanian", lv: "Latvian", mk: "Macedonian", nb: "Norwegian", nl: "Dutch", pl: "Polish", pt: "Portuguese",
  ro: "Romanian", sk: "Slovak", sl: "Slovenian", sq: "Albanian", sr: "Serbian", sv: "Swedish", uk: "Ukrainian"
};

interface Row { code: string | null; name: string; sub: string | null; find: string }

export default function Language() {
  const { t, lang, choice, setLanguage } = useI18n();
  const { C, S } = useTheme();
  const [query, setQuery] = useState("");

  const rows = useMemo<Row[]>(() => {
    // The name in the app language, when the phone's Intl knows it (not every engine does)
    let names: Intl.DisplayNames | null = null;
    try { names = new Intl.DisplayNames([lang], { type: "language" }); } catch { /* no localised names */ }
    const local = (code: string) => { try { return names?.of(code) || null; } catch { return null; } };
    const own = (code: string) => LANGUAGES.find((l) => l.code === code)?.name ?? code;
    const phone = phoneLanguage();
    const list: Row[] = [{ code: null, name: t("app_languageAuto"), sub: own(phone), find: norm(t("app_languageAuto")) }];
    for (const l of LANGUAGES) {
      const loc = local(l.code);
      const sub = loc && norm(loc) !== norm(l.name) ? loc[0].toLocaleUpperCase(lang) + loc.slice(1) : null;
      list.push({ code: l.code, name: l.name, sub, find: norm([l.name, loc, ENGLISH[l.code], l.code].filter(Boolean).join(" ")) });
    }
    return list;
  }, [lang, t]);

  const q = norm(query);
  const shown = q ? rows.filter((r) => r.find.includes(q)) : rows;
  const pick = (code: string | null) => { setLanguage(code); router.back(); };

  return (
    <View style={S.screen}>
      <View style={{ padding: 12, borderBottomWidth: 1, borderColor: C.line, backgroundColor: C.card }}>
        <Input style={[S.input, { minHeight: 44 }]} value={query} onChangeText={setQuery} placeholder={t("app_languageSearch")}
          accessibilityLabel={t("app_languageSearch")} autoCorrect={false} autoCapitalize="none" returnKeyType="search" clearButtonMode="while-editing" />
      </View>
      <FlatList
        data={shown}
        keyExtractor={(r) => r.code ?? "auto"}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={30}
        contentContainerStyle={{ paddingBottom: 24 }}
        accessibilityRole="radiogroup"
        accessibilityLabel={t("app_language")}
        renderItem={({ item }) => {
          const on = choice === item.code;
          return (
            <Pressable onPress={() => pick(item.code)} accessibilityRole="radio" accessibilityState={{ checked: on }}
              accessibilityLabel={item.sub ? `${item.name}, ${item.sub}` : item.name}
              style={({ pressed }) => [S.row, { minHeight: 52, gap: 12, paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderColor: C.line,
                backgroundColor: pressed ? C.chip : C.card }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[S.body, on && { fontWeight: "700" }]}>{item.name}</Text>
                {!!item.sub && <Text style={S.muted}>{item.sub}</Text>}
              </View>
              {on && <Icon name="check" size={20} color={C.link} />}
            </Pressable>
          );
        }}
      />
    </View>
  );
}
