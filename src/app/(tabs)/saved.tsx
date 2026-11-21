// Saved places and "my vet": stored whole on the phone, so this works offline.
import { useCallback, useState } from "react";
import { FlatList, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useI18n } from "../../i18n";
import { listSaved, type SavedPlace } from "../../lib/saved";
import { Icon } from "../../ui/Icon";
import { PlaceCard, useMinuteClock } from "../../ui/PlaceCard";
import { useTheme } from "../../ui/theme";

export default function Saved() {
  const { t } = useI18n();
  const { C, S } = useTheme();
  const [list, setList] = useState<SavedPlace[]>([]);
  const now = useMinuteClock();   // "closes at" stays right while the list is on screen
  useFocusEffect(useCallback(() => { listSaved().then(setList).catch(() => undefined); }, []));
  return (
    <View style={S.screen}>
      <FlatList
        data={list}
        extraData={now}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <View style={[S.row, { gap: 8, alignItems: "flex-start" }]}>
            <Icon name="bookmark" size={18} color={C.muted} style={{ marginTop: 1 }} />
            <Text style={[S.muted, { flex: 1 }]}>{t("app_noSaved")}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View>
            {item.myVet && (
              <View style={[S.row, { gap: 5, marginBottom: 4 }]}>
                <Icon name="home" size={14} color={C.muted} />
                <Text style={[S.muted, { fontWeight: "600" }]}>{t("app_myVet")}</Text>
              </View>
            )}
            {/* Saved without a search: no distance to show. */}
            <PlaceCard p={{ ...item, dist: NaN }} big={item.myVet} now={now} />
          </View>
        )}
      />
    </View>
  );
}
