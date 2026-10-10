import { StyleSheet } from "react-native";

export const C = {
  bg: "#f8fafc",
  card: "#ffffff",
  text: "#0f172a",
  muted: "#64748b",
  line: "#e2e8f0",
  brand: "#ea580c",
  brandDark: "#c2410c",
  danger: "#dc2626",
  ok: "#16a34a",
  warn: "#d97706",
  chip: "#f1f5f9"
};

export const S = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  pad: { padding: 16 },
  card: { backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  h1: { fontSize: 22, fontWeight: "700", color: C.text },
  h2: { fontSize: 17, fontWeight: "700", color: C.text },
  body: { fontSize: 15, color: C.text, lineHeight: 21 },
  muted: { fontSize: 13, color: C.muted, lineHeight: 18 },
  row: { flexDirection: "row", alignItems: "center" },
  input: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: C.text },
  btn: { backgroundColor: C.brand, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  btnGhost: { backgroundColor: C.chip, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, alignItems: "center", justifyContent: "center" },
  btnGhostText: { color: C.text, fontSize: 15, fontWeight: "600" }
});
