// Lost or found dog: first steps, the official registers of the chosen country,
// and local search groups run by volunteers (see src/lib/lost.ts). Opened from
// the Emergency tab.
import { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { useI18n } from "../i18n";
import { defaultLostCountry, LOST_COUNTRIES, LOST_GROUPS_FORM, LOST_LINKS, LOST_STEPS, lastKnownSpot, lostGroups,
  type LostCountry, type LostGroup, type LostMode } from "../lib/lost";
import { Icon, Symbol } from "../ui/Icon";
import { useTheme } from "../ui/theme";

const host = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } };
const open = (url: string) => Linking.openURL(url).catch(() => undefined);

/** One choice of a group (lost or found, the country): a radio button of 44 px. */
function Choice({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
  const { C, S } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: on }}
      style={({ pressed }) => [{ minHeight: 44, justifyContent: "center", paddingHorizontal: 14, borderRadius: 22, backgroundColor: on ? C.brandDark : C.chip }, pressed && S.pressed]}>
      <Text style={{ color: on ? C.onBrand : C.text, fontWeight: on ? "700" : "600" }}>{label}</Text>
    </Pressable>
  );
}

// Name and website on one line: a step with two links stays short.
function LinkButton({ label, sub, url }: { label: string; sub: string; url: string }) {
  const { C, S } = useTheme();
  return (
    <Pressable onPress={() => open(url)} accessibilityRole="link" accessibilityLabel={`${label}, ${sub}`}
      style={({ pressed }) => [S.row, { gap: 6, minHeight: 44, borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: C.chip },
        pressed && S.pressed]}>
      <Text style={{ flexShrink: 1, fontWeight: "700", color: C.text }}>{label}  <Text style={[S.muted, { fontSize: 12, fontWeight: "500" }]}>{sub}</Text></Text>
      <Icon name="external-link" size={14} color={C.muted} />
    </Pressable>
  );
}

// Local search groups, inside the step about sharing locally / reporting a found dog.
function Groups({ groups, t }: { groups: LostGroup[] | null; t: (k: string) => string }) {
  const { C, S } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      {groups && (
        <Text style={S.muted}><Text style={{ fontWeight: "700", color: C.text }}>{t("lostGroupsTitle")}. </Text>
          {t(groups.length ? "lostGroupsNote" : "lostGroupsNone")}</Text>
      )}
      {!!groups && groups.length > 0 && (
        <View style={[S.row, { gap: 8, flexWrap: "wrap" }]}>
          {groups.map((g) => <LinkButton key={g.id} label={g.name} sub={g.region || host(g.url)} url={g.url} />)}
        </View>
      )}
      <Pressable onPress={() => open(LOST_GROUPS_FORM)} accessibilityRole="link"
        style={({ pressed }) => [S.row, { gap: 6, minHeight: 44 }, pressed && S.pressed]}>
        <Text style={{ flexShrink: 1, color: C.link, fontWeight: "600" }}>{t("lostGroupsAdd")}</Text>
        <Icon name="external-link" size={16} color={C.link} />
      </Pressable>
    </View>
  );
}

export default function Lost() {
  const { t, lang } = useI18n();
  const { C, S } = useTheme();
  const [mode, setMode] = useState<LostMode>("lost");
  const [country, setCountry] = useState<LostCountry>(defaultLostCountry);
  const [groups, setGroups] = useState<LostGroup[] | null>(null);

  useEffect(() => {
    let gone = false;
    setGroups(null);
    lastKnownSpot().then((here) => lostGroups(country, here)).then((g) => { if (!gone) setGroups(g); });
    return () => { gone = true; };
  }, [country]);

  const countryName = (c: LostCountry) => {
    if (c === "EU") return t("lostOtherCountry");
    try { return new Intl.DisplayNames([lang], { type: "region" }).of(c) || c; } catch { return c; }
  };
  const links = LOST_LINKS[country];

  return (
    <ScrollView style={S.screen} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={S.body}>{t("lostIntro")}</Text>
      <View style={[S.row, { gap: 8, flexWrap: "wrap" }]} accessibilityRole="radiogroup">
        <Choice on={mode === "lost"} label={t("lostTabLost")} onPress={() => setMode("lost")} />
        <Choice on={mode === "found"} label={t("lostTabFound")} onPress={() => setMode("found")} />
      </View>
      <Text style={S.muted}>{t("lostCountry")}</Text>
      <View style={[S.row, { gap: 8, flexWrap: "wrap" }]} accessibilityRole="radiogroup" accessibilityLabel={t("lostCountry")}>
        {LOST_COUNTRIES.map((c) => <Choice key={c} on={c === country} label={countryName(c)} onPress={() => setCountry(c)} />)}
      </View>

      {LOST_STEPS[mode].map((s, i) => (
        <View key={s.key} style={[S.card, { gap: 8 }]}>
          {/* the step's number on a disc; read as one line: "1. Don't chase your dog…" */}
          <View style={[S.row, { gap: 10, alignItems: "flex-start" }]} accessible accessibilityLabel={`${i + 1}. ${t(s.key)}`}>
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: C.chip, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: C.link, fontWeight: "700" }}>{i + 1}</Text>
            </View>
            <Text style={[S.body, { flex: 1, marginTop: 3 }]}>{t(s.key)}</Text>
          </View>
          {(s.links || []).some((k) => links[k]) && (
            <View style={[S.row, { gap: 8, flexWrap: "wrap" }]}>
              {(s.links || []).map((k) => links[k] && <LinkButton key={k} label={t(links[k]!.key)} sub={host(links[k]!.url)} url={links[k]!.url} />)}
            </View>
          )}
          {(s.key === "lostStep4" || s.key === "foundStep3") && <Groups groups={groups} t={t} />}
          {s.emergency && (
            <Pressable style={({ pressed }) => [S.btn, S.row, { gap: 8, backgroundColor: C.dangerFill }, pressed && S.pressed]}
              onPress={() => router.dismissTo("/(tabs)/emergency")} accessibilityRole="button">
              <Symbol name="alarm-light-outline" size={20} color={C.onBrand} />
              <Text style={[S.btnText, { flexShrink: 1 }]}>{t("app_findOpenVet")}</Text>
            </Pressable>
          )}
        </View>
      ))}
      {country === "EU" && <Text style={S.muted}>{t("lostOtherNote")}</Text>}
    </ScrollView>
  );
}
