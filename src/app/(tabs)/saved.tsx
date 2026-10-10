// Saved places and "my vet": stored whole on the phone, so this works offline.
import { useCallback, useState } from "react";
import { FlatList, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useI18n } from "../../i18n";
import { listSaved, type SavedPlace } from "../../lib/saved";
import { PlaceCard } from "../../ui/PlaceCard";
import { S } from "../../ui/theme";

export default function Saved() {
  const { t } = useI18n();
  const [list, setList] = useState<SavedPlace[]>([]);
  useFocusEffect(useCallback(() => { listSaved().then(setList).catch(() => undefined); }, []));
  return (
    <View style={S.screen}>
      <FlatList
        data={list}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Text style={S.muted}>⭐ {t("app_noSaved")}</Text>}
        renderItem={({ item }) => (
          <View>
            {item.myVet && <Text style={[S.muted, { marginBottom: 4 }]}>⭐ {t("app_myVet")}</Text>}
            <PlaceCard p={{ ...item, dist: NaN }} big={item.myVet} />
          </View>
        )}
      />
    </View>
  );
}
