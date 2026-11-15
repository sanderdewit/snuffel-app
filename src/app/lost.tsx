// Lost or found dog: first steps, the official registers of the chosen country,
// and local search groups run by volunteers (see src/lib/lost.ts). Opened from
// the Emergency tab.
import { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { useI18n } from "../i18n";
import { defaultLostCountry, LOST_COUNTRIES, LOST_GROUPS_FORM, LOST_LINKS, LOST_STEPS, lastKnownSpot, lostGroups,
  type LostCountry, type LostGroup, type LostMode } from "../lib/lost";
import { C, S } from "../ui/theme";

const host = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } };

function Chip({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }}
      style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, backgroundColor: on ? C.brandDark : C.chip }}>
      <Text style={{ color: on ? "#fff" : C.text, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

// Name and website on one line: a step with two links stays short.
function LinkButton({ label, sub, url }: { label: string; sub: string; url: string }) {
  return (
    <Pressable onPress={() => Linking.openURL(url)} accessibilityRole="link"
      style={{ borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: C.chip }}>
      <Text style={{ fontWeight: "700", color: C.text }}>{label} ↗  <Text style={[S.muted, { fontSize: 12, fontWeight: "500" }]}>{sub}</Text></Text>
    </Pressable>
  );
}

// Local search groups, inside the step about sharing locally / reporting a found dog.
function Groups({ groups, t }: { groups: LostGroup[] | null; t: (k: string) => string }) {
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
      <Pressable onPress={() => Linking.openURL(LOST_GROUPS_FORM)} accessibilityRole="link" hitSlop={8}>
        <Text style={{ color: C.brandDark, fontWeight: "600" }}>{t("lostGroupsAdd")} ↗</Text>
      </Pressable>
    </View>
  );
}

export default function Lost() {
  const { t, lang } = useI18n();
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
      <View style={[S.row, { gap: 8, flexWrap: "wrap" }]}>
        <Chip on={mode === "lost"} label={t("lostTabLost")} onPress={() => setMode("lost")} />
        <Chip on={mode === "found"} label={t("lostTabFound")} onPress={() => setMode("found")} />
      </View>
      <Text style={S.muted}>{t("lostCountry")}</Text>
      <View style={[S.row, { gap: 8, flexWrap: "wrap" }]}>
        {LOST_COUNTRIES.map((c) => <Chip key={c} on={c === country} label={countryName(c)} onPress={() => setCountry(c)} />)}
      </View>

      {LOST_STEPS[mode].map((s, i) => (
        <View key={s.key} style={[S.card, { gap: 8 }]}>
          <Text style={S.body}><Text style={{ fontWeight: "700" }}>{i + 1}. </Text>{t(s.key)}</Text>
          {(s.links || []).some((k) => links[k]) && (
            <View style={[S.row, { gap: 8, flexWrap: "wrap" }]}>
              {(s.links || []).map((k) => links[k] && <LinkButton key={k} label={t(links[k]!.key)} sub={host(links[k]!.url)} url={links[k]!.url} />)}
            </View>
          )}
          {(s.key === "lostStep4" || s.key === "foundStep3") && <Groups groups={groups} t={t} />}
          {s.emergency && (
            <Pressable style={[S.btn, { backgroundColor: C.danger }]} onPress={() => router.navigate("/(tabs)/emergency")} accessibilityRole="button">
              <Text style={S.btnText}>{t("aiCtaEmergency")}</Text>
            </Pressable>
          )}
        </View>
      ))}
      {country === "EU" && <Text style={S.muted}>{t("lostOtherNote")}</Text>}
    </ScrollView>
  );
}
