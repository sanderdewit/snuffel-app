// The two settings that tie AI help to this dog's file (from its row in the health
// file): a short summary goes along with questions, and signs mentioned in the chat
// are noted in the file. Each is saved as soon as it is switched.
import { useEffect, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useI18n } from "../../../i18n";
import { autoFile, setAutoFile, setShareFileWithAi, shareFileWithAi } from "../../../lib/dogfile";
import { Icon, type IconName } from "../../../ui/Icon";
import { Toggle } from "../../../ui/Toggle";
import { useTheme } from "../../../ui/theme";

export default function DogAiSettings() {
  const { t } = useI18n();
  const { C, S } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const dogId = Number(id);
  const [share, setShare] = useState<boolean | null>(null);
  const [auto, setAuto] = useState<boolean | null>(null);
  useEffect(() => {
    Promise.all([shareFileWithAi(dogId), autoFile(dogId)]).then(([s, a]) => { setShare(s); setAuto(a); }).catch(() => undefined);
  }, [dogId]);

  const change = async (set: (v: boolean) => void, save: (id: number, v: boolean) => Promise<void>, v: boolean) => {
    set(v);
    try { await save(dogId, v); } catch { set(!v); Alert.alert(t("app_actionFailed")); }
  };

  const setting = (icon: IconName, title: string, text: string, value: boolean, onChange: (v: boolean) => void) => (
    <View style={[S.card, { gap: 6 }]}>
      <View style={[S.row, { gap: 10, minHeight: 44 }]}>
        <Icon name={icon} size={20} color={C.muted} />
        <Text style={[S.h2, { flex: 1 }]}>{title}</Text>
        <Toggle value={value} onValueChange={onChange} label={title} />
      </View>
      <Text style={S.muted}>{text}</Text>
    </View>
  );

  return (
    <ScrollView style={S.screen} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Stack.Screen options={{ title: t("app_aiSettings") }} />
      {share != null && setting("message-circle", t("app_shareWithAi"), t("app_shareWithAiText"), share, (v) => change(setShare, setShareFileWithAi, v))}
      {auto != null && setting("thermometer", t("app_autoFile"), t("app_autoFileText"), auto, (v) => change(setAuto, setAutoFile, v))}
    </ScrollView>
  );
}
