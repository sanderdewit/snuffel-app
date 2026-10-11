// Place details: call, route, website, save / my vet, share. Opened from a list
// (the place is handed over in memory) or from a link (looked up again by id).
import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, Share, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useI18n } from "../../i18n";
import { CATEGORIES, placeById, refreshOpenState, type Place } from "../../lib/places";
import { recall } from "../../lib/placeStore";
import { isSaved, save, setMyVet, unsave } from "../../lib/saved";
import { callUrl, ChainBadge, directionsUrl, displayName, OpenBadge } from "../../ui/PlaceCard";
import { C, S } from "../../ui/theme";

// OpenStreetMap's editor for this place: corrections go to the source.
function osmEditUrl(id: string): string | null {
  const m = /^([nwr])(\d+)$/.exec(id);
  return m ? `https://www.openstreetmap.org/edit?${({ n: "node", w: "way", r: "relation" } as const)[m[1] as "n" | "w" | "r"]}=${m[2]}` : null;
}

export default function PlaceScreen() {
  const { t } = useI18n();
  const { id, lat, lon } = useLocalSearchParams<{ id: string; lat?: string; lon?: string }>();
  const [p, setP] = useState<Place | null>(() => recall(id));
  const [missing, setMissing] = useState(false);
  const [state, setState] = useState({ saved: false, myVet: false });

  useEffect(() => {
    if (!p && lat && lon) placeById(id, Number(lat), Number(lon)).then((x) => (x ? setP(x) : setMissing(true)));
    else if (!p) setMissing(true);
    isSaved(id).then(setState).catch(() => undefined);
  }, [id, lat, lon, p]);

  if (!p) return <View style={[S.screen, S.pad]}>{missing ? <Text style={S.muted}>{t("noResults")}</Text> : <ActivityIndicator color={C.brand} />}</View>;
  refreshOpenState([p]);
  const cat = CATEGORIES[p.cat];
  const toggleSave = async () => { if (state.saved) await unsave(p.id); else await save(p); setState(await isSaved(p.id)); };
  const toggleMyVet = async () => { await setMyVet(p, !state.myVet); setState(await isSaved(p.id)); };
  const share = () => Share.share({ message: [displayName(p, t), p.address, directionsUrl(p)].filter(Boolean).join("\n") });
  const isVet = p.cat === "vet" || p.cat === "hospital";

  return (
    <ScrollView style={S.screen} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Stack.Screen options={{ title: t(cat.key) }} />
      <View style={{ gap: 4 }}>
        <Text style={S.h1}>{cat.icon} {displayName(p, t)}</Text>
        {!!p.address && <Text style={S.body}>{p.address}</Text>}
        <View style={[S.row, { gap: 12, flexWrap: "wrap" }]}><OpenBadge p={p} /><ChainBadge p={p} /></View>
        {p.chain && p.chainVia && <Text style={S.muted}>({t("via_" + p.chainVia)})</Text>}
      </View>

      <View style={[S.row, { gap: 10 }]}>
        {!!p.phone && (
          <Pressable style={[S.btn, { flex: 1 }]} onPress={() => Linking.openURL(callUrl(p.phone!))} accessibilityRole="button">
            <Text style={S.btnText}>📞 {t("call")}</Text>
          </Pressable>
        )}
        <Pressable style={[S.btn, { flex: 1, backgroundColor: C.text }]} onPress={() => Linking.openURL(directionsUrl(p))} accessibilityRole="button">
          <Text style={S.btnText}>🧭 {t("directions")}</Text>
        </Pressable>
      </View>

      <View style={S.card}>
        <Text style={S.h2}>🕒 {t("app_openingHours")}</Text>
        <Text style={[S.body, { marginTop: 4 }]}>{p.hours ? p.hours.split(";").map((s) => s.trim()).join("\n") : t("app_hoursUnknown")}</Text>
        {p.hoursFromSite && <Text style={[S.muted, { marginTop: 4, fontStyle: "italic" }]}>{t("hoursFromWebsite")}</Text>}
        {p.emergency === "on_call" && <Text style={[S.body, { marginTop: 6 }]}>📞 {t("emergencyOnCall")}{p.emergencyPhone ? ": " + p.emergencyPhone : ""}</Text>}
        {p.emergency === "24/7" && <Text style={[S.body, { marginTop: 6 }]}>🚑 {t("emergency247")}</Text>}
        {!!osmEditUrl(p.id) && (
          <Pressable onPress={() => Linking.openURL(osmEditUrl(p.id)!)} accessibilityRole="link" style={{ marginTop: 6 }}>
            <Text style={[S.muted, { textDecorationLine: "underline" }]}>{t("hoursFix")}</Text>
          </Pressable>
        )}
      </View>

      <View style={[S.row, { gap: 8, flexWrap: "wrap" }]}>
        <Pressable style={S.btnGhost} onPress={toggleSave}><Text style={S.btnGhostText}>{state.saved ? "★ " + t("app_saved") : "☆ " + t("app_save")}</Text></Pressable>
        {isVet && (
          <Pressable style={S.btnGhost} onPress={toggleMyVet}><Text style={S.btnGhostText}>⭐ {t(state.myVet ? "app_unsetMyVet" : "app_setMyVet")}</Text></Pressable>
        )}
        {!!p.website && (
          <Pressable style={S.btnGhost} onPress={() => Linking.openURL(/^https?:/i.test(p.website!) ? p.website! : "https://" + p.website)}>
            <Text style={S.btnGhostText}>🌐 {t("website")}</Text>
          </Pressable>
        )}
        <Pressable style={S.btnGhost} onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((p.name || "") + " " + p.lat + "," + p.lon)}`)}>
          <Text style={S.btnGhostText}>⭐ {t("reviews")}</Text>
        </Pressable>
        <Pressable style={S.btnGhost} onPress={share}><Text style={S.btnGhostText}>↗ {t("app_share")}</Text></Pressable>
      </View>
      <Text style={S.muted}>{t("footerProto")}</Text>
    </ScrollView>
  );
}
