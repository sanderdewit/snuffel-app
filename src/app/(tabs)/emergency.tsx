// Emergency: one tap (this tab, or the home-screen shortcut) uses GPS and lists
// vets and animal hospitals that are open now, nearest first; closed ones are
// hidden and the search widens until there are options. "My vet" stays on top
// with a call button.
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Linking, Pressable, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useI18n } from "../../i18n";
import { currentPosition, LocationDeniedError } from "../../lib/geo";
import { emergency, emergencyRank, NotCoveredError, type Place } from "../../lib/places";
import { myVet, type SavedPlace } from "../../lib/saved";
import { callUrl, PlaceCard } from "../../ui/PlaceCard";
import { C, S } from "../../ui/theme";

export default function Emergency() {
  const { t, tf } = useI18n();
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [radiusM, setRadiusM] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vet, setVet] = useState<SavedPlace | null>(null);

  const run = useCallback(async () => {
    setBusy(true); setError(null);
    try {
      const pos = await currentPosition();
      const r = await emergency(pos.lat, pos.lon);
      setPlaces(r.places); setRadiusM(r.radiusM);
    } catch (e) {
      setError(e instanceof LocationDeniedError ? t("app_locationNeeded") : e instanceof NotCoveredError ? t("app_noCoverage") : t("app_errLoad"));
    } finally { setBusy(false); }
  }, [t]);

  // Opening the tab is the "one tap". Coming back from a place's details within
  // a couple of minutes keeps the list instead of searching again.
  const lastRun = useRef(0);
  useFocusEffect(useCallback(() => {
    myVet().then(setVet).catch(() => undefined);
    if (Date.now() - lastRun.current > 2 * 60 * 1000) { lastRun.current = Date.now(); run(); }
  }, [run]));

  const anyOpen = !!places && places.some((p) => emergencyRank(p) === 0);

  return (
    <View style={S.screen}>
      <FlatList
        data={places || []}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: 16 }}
        ListHeaderComponent={
          <View style={{ gap: 10, marginBottom: 10 }}>
            <View style={[S.card, { backgroundColor: "#fef2f2", borderColor: "#fecaca" }]}>
              <Text style={[S.body, { color: "#7f1d1d" }]}>🚨 {t("emergencyBanner")}</Text>
            </View>
            {vet && (
              <View style={S.card}>
                <Text style={S.muted}>⭐ {t("app_myVet")}</Text>
                <Text style={S.h2}>{vet.name}</Text>
                {!!vet.phone && (
                  <Pressable style={[S.btn, { backgroundColor: C.danger, marginTop: 8 }]} onPress={() => Linking.openURL(callUrl(vet.phone!))}>
                    <Text style={S.btnText}>📞 {t("call")}</Text>
                  </Pressable>
                )}
              </View>
            )}
            <Pressable style={[S.btn, { backgroundColor: C.danger }]} onPress={run} disabled={busy} accessibilityRole="button">
              <Text style={S.btnText}>📍 {t("app_findOpenVet")}</Text>
            </Pressable>
            {busy && <ActivityIndicator size="large" color={C.danger} />}
            {!!error && <Text style={[S.body, { color: C.danger }]}>{error}</Text>}
            {!busy && places && radiusM > 10000 && <Text style={S.muted}>{tf("emergencyRadiusNote", { km: Math.round(radiusM / 1000) })}</Text>}
            {!busy && places && !anyOpen && <Text style={[S.body, { color: C.warn }]}>{t("emergencyNone")}</Text>}
            {!busy && places && !places.length && <Text style={S.muted}>🐶 {t("noResults")}</Text>}
          </View>
        }
        renderItem={({ item, index }) => {
          // Unknown hours below a divider (often simply closed: evenings, weekends),
          // then closed clinics whose phone line reaches the on-call vet.
          const rank = emergencyRank(item);
          const heading = rank > 0 && (index === 0 || emergencyRank(places![index - 1]) < rank)
            ? t(rank === 1 ? "emergencyUnknownHeading" : "emergencyOnCallHeading") : null;
          return (
            <>
              {heading && <Text style={[S.muted, { fontWeight: "700", marginTop: 6, marginBottom: 6 }]}>{heading}</Text>}
              <PlaceCard p={item} big />
            </>
          );
        }}
        ListFooterComponent={places && places.length ? <Text style={[S.muted, { textAlign: "center" }]}>{t("app_callFirst")}</Text> : null}
      />
    </View>
  );
}
