// A date, chosen with the phone's own date picker (Android: calendar dialog;
// iOS: calendar in a sheet) and shown as "30 april 2021". The value is kept as
// YYYY-MM-DD, "" when not set. `children` replaces the default field look (the
// reminders use a plain "Choose a date" button that saves right away).
import { useState } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useI18n } from "../i18n";
import { formatDate, fromIso, isoDate, today, validDate } from "../lib/dates";
import { C, S } from "./theme";

interface Props {
  value: string;
  onChange: (iso: string) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  placeholder?: string;
  children?: React.ReactNode;   // a custom trigger instead of the field
  accessibilityLabel?: string;
}

export function DateField({ value, onChange, minimumDate, maximumDate, placeholder, children, accessibilityLabel }: Props) {
  const { t, lang } = useI18n();
  const [iosOpen, setIosOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(new Date());
  const start = validDate(value) ? fromIso(value) : maximumDate && maximumDate < new Date() ? maximumDate : fromIso(today());

  const open = () => {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: start, mode: "date", minimumDate, maximumDate,
        onChange: (e, d) => { if (e.type === "set" && d) onChange(isoDate(d)); }
      });
    } else { setDraft(start); setIosOpen(true); }
  };

  return (
    <>
      <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
        {children ?? (
          <View style={[S.input, { justifyContent: "center" }]}>
            <Text style={{ fontSize: 16, color: value ? C.text : C.muted }}>{value ? formatDate(value, lang) : placeholder ?? t("app_pickDate")}</Text>
          </View>
        )}
      </Pressable>
      {Platform.OS === "ios" && (
        <Modal visible={iosOpen} transparent animationType="slide" onRequestClose={() => setIosOpen(false)}>
          <Pressable style={{ flex: 1, backgroundColor: "#0006" }} onPress={() => setIosOpen(false)} />
          <View style={{ backgroundColor: C.card, padding: 16, paddingBottom: 32 }}>
            <DateTimePicker value={draft} mode="date" display="inline" locale={lang} minimumDate={minimumDate} maximumDate={maximumDate}
              onChange={(_, d) => d && setDraft(d)} />
            <Pressable style={S.btn} onPress={() => { setIosOpen(false); onChange(isoDate(draft)); }} accessibilityRole="button">
              <Text style={S.btnText}>{t("app_done")}</Text>
            </Pressable>
          </View>
        </Modal>
      )}
    </>
  );
}
