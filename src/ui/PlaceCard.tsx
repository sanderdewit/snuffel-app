import { Linking, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useI18n } from "../i18n";
import { CATEGORIES, type Place } from "../lib/places";
import { remember } from "../lib/placeStore";
import { C, S } from "./theme";

export const directionsUrl = (p: Place) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`;
export const callUrl = (phone: string) => "tel:" + phone.replace(/[^\d+]/g, "");

export function displayName(p: Place, t: (k: string) => string) {
  return p.name || "(" + t(CATEGORIES[p.cat].key) + ")";
}

export function OpenBadge({ p }: { p: Place }) {
  const { t } = useI18n();
  if (p.is247) return <Text style={{ color: C.ok, fontWeight: "700" }}>● {t("open247")}</Text>;
  if (p.openNow === true) return <Text style={{ color: C.ok, fontWeight: "700" }}>● {t("openNow")}</Text>;
  if (p.openNow === false) return <Text style={{ color: C.muted, fontWeight: "600" }}>● {t("closedNow")}</Text>;
  return null;
}

export function ChainBadge({ p }: { p: Place }) {
  const { t, tf } = useI18n();
  if (p.chain) return <Text style={{ color: C.warn, fontWeight: "600" }}>⚠️ {tf("chainBadge", { name: p.chain })}</Text>;
  if (p.cat === "play" || p.cat === "shelter") return null;
  return <Text style={{ color: C.ok, fontWeight: "600" }}>✓ {t("independent")}</Text>;
}

export function PlaceCard({ p, big }: { p: Place; big?: boolean }) {
  const { t, tf } = useI18n();
  const cat = CATEGORIES[p.cat];
  const open = () => { remember(p); router.push({ pathname: "/place/[id]", params: { id: p.id, lat: String(p.lat), lon: String(p.lon) } }); };
  return (
    <Pressable onPress={open} style={({ pressed }) => [S.card, { marginBottom: 10, opacity: pressed ? 0.85 : 1 }]} accessibilityRole="button">
      <View style={[S.row, { gap: 10, alignItems: "flex-start" }]}>
        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: cat.color + "22", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 19 }}>{cat.icon}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[S.h2, big && { fontSize: 19 }]} numberOfLines={2}>{displayName(p, t)}</Text>
          <Text style={S.muted} numberOfLines={1}>
            {t(cat.key)}{Number.isFinite(p.dist) ? " · " + tf("distanceAway", { km: p.dist < 10 ? p.dist.toFixed(1) : Math.round(p.dist) }) : ""}
          </Text>
          {!!p.address && <Text style={S.muted} numberOfLines={1}>{p.address}</Text>}
          <View style={[S.row, { gap: 12, flexWrap: "wrap", marginTop: 2 }]}>
            <OpenBadge p={p} />
            <ChainBadge p={p} />
          </View>
        </View>
      </View>
      {big && (
        <View style={[S.row, { gap: 10, marginTop: 12 }]}>
          {!!p.phone && (
            <Pressable style={[S.btn, { flex: 1, backgroundColor: C.danger }]} onPress={() => Linking.openURL(callUrl(p.phone!))} accessibilityRole="button">
              <Text style={S.btnText}>📞 {t("call")}</Text>
            </Pressable>
          )}
          <Pressable style={[S.btnGhost, { flex: 1 }]} onPress={() => Linking.openURL(directionsUrl(p))} accessibilityRole="button">
            <Text style={S.btnGhostText}>🧭 {t("directions")}</Text>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
}
