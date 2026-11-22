#!/usr/bin/env bash
# App Store screenshots on an iOS simulator (macOS CI runner).
#   tools/screenshots.sh <path to Snuffel.app> <output dir> [languages...]
# 6.9" iPhone (1320 x 2868), the size App Store Connect requires; smaller
# iPhones reuse it. Location: Amsterdam. The app runs in screenshot mode
# (-SnuffelDemo YES: sample dog, reminders, my vet, one real AI answer).
# Each language gets its own phone locale from store/locales.json (sr: Latin
# script, sr-Latn / sr_Latn_RS; nb: Bokmål, nb / nb_NO).
set -euo pipefail
APP="$1"; OUT="$2"; shift 2
LANGS=("${@:-nl en}")
BUNDLE=app.snuffel
LOCALES="$(cd "$(dirname "$0")/.." && pwd)/store/locales.json"

# The phone locale of an app language (BCP 47, e.g. sr-Latn-RS), empty when unknown.
spot_of() {   # "lat,lon" of the language's capital (store/locales.json)
  python3 -c 'import json, sys; s = json.load(open(sys.argv[1]))["languages"][sys.argv[2]]["spot"]; print("%s,%s" % (s["lat"], s["lon"]))' "$LOCALES" "$1"
}
locale_of() {
  python3 -c 'import json, sys; l = json.load(open(sys.argv[1]))["languages"].get(sys.argv[2]); print(l["locale"] if l else "")' "$LOCALES" "$1"
}
for L in ${LANGS[@]}; do   # all known before the first simulator starts
  [ -n "$(locale_of "$L")" ] || { echo "unknown language $L (not in store/locales.json)"; exit 1; }
done

# The newest "Pro Max" simulator available on this runner.
DEVICE_TYPE=$(xcrun simctl list devicetypes -j | python3 -c '
import json, sys
types = [t for t in json.load(sys.stdin)["devicetypes"] if "Pro Max" in t["name"]]
print(sorted(types, key=lambda t: t["identifier"])[-1]["identifier"])')
RUNTIME=$(xcrun simctl list runtimes -j | python3 -c '
import json, sys
rts = [r for r in json.load(sys.stdin)["runtimes"] if r["platform"] == "iOS" and r["isAvailable"]]
print(sorted(rts, key=lambda r: [int(x) for x in r["version"].split(".")])[-1]["identifier"])')
echo "device $DEVICE_TYPE, runtime $RUNTIME"

launch() {   # launch <lang> [route]   (the language's locale: APPLE_LANG, LOCALE)
  xcrun simctl terminate "$UDID" "$BUNDLE" > /dev/null 2>&1 || true
  xcrun simctl launch "$UDID" "$BUNDLE" -AppleLanguages "($APPLE_LANG)" -AppleLocale "$LOCALE" -SnuffelDemo YES \
    ${2:+-SnuffelDemoRoute "$2"} > /dev/null
}
# Each screen: restart the app at that route (links would trigger iOS's
# "Open in Snuffel?" prompt).
shot() {   # shot <lang> <name> <route> <seconds to settle>
  launch "$1" "$3"
  sleep "$4"
  xcrun simctl io "$UDID" screenshot "$OUT/$1/$2.png" > /dev/null
  # A (nearly) black image means the app was still starting: wait and take it again.
  if [ "$(stat -f%z "$OUT/$1/$2.png")" -lt 120000 ]; then
    sleep 8; xcrun simctl io "$UDID" screenshot "$OUT/$1/$2.png" > /dev/null; echo "  $1/$2.png (taken again)"
  fi
  echo "  $1/$2.png"
}

for L in ${LANGS[@]}; do
  TAG=$(locale_of "$L")
  LOCALE=${TAG//-/_}       # nl_NL, sr_Latn_RS
  APPLE_LANG=${TAG%-*}     # nl, sr-Latn, nb
  echo "== $L: language $APPLE_LANG, locale $LOCALE"
  mkdir -p "$OUT/$L"
  UDID=$(xcrun simctl create "snuffel-$L" "$DEVICE_TYPE" "$RUNTIME")
  xcrun simctl boot "$UDID"
  xcrun simctl bootstatus "$UDID" -b > /dev/null
  xcrun simctl ui "$UDID" appearance light   # the app follows the phone: store images stay light
  xcrun simctl status_bar "$UDID" override --time "9:41" --dataNetwork wifi --wifiBars 3 --cellularMode active --cellularBars 4 --batteryState charged --batteryLevel 100
  xcrun simctl location "$UDID" set "$(spot_of "$L")"
  xcrun simctl install "$UDID" "$APP"
  xcrun simctl privacy "$UDID" grant location "$BUNDLE"
  launch "$L"
  sleep 30   # first start: place data, demo data incl. one AI answer
  echo "$L:"
  shot "$L" 2-emergency "/emergency" 25   # GPS + widening search; 16 s was sometimes too short
  shot "$L" 3-map       "/?near=1&view=map" 20
  shot "$L" 4-ask       "/ask" 8
  shot "$L" 5-dog       "/dog/1" 8
  shot "$L" 6-file      "/dog/file/1" 8
  shot "$L" 7-saved     "/saved" 8
  # Find last: by now a system banner from the fresh simulator ("Ready for Apple
  # Intelligence") is gone, and the location is set once more (a first fix can be late).
  xcrun simctl location "$UDID" set "$(spot_of "$L")"
  shot "$L" 1-find      "/?near=1&view=list" 16
  # First-run walkthrough, for review only (review/ is not uploaded to the store).
  mkdir -p "$OUT/review"
  for s in 0 1 2 3 4 5; do
    launch "$L" "/welcome?step=$s"; sleep 6
    xcrun simctl io "$UDID" screenshot "$OUT/review/$L-welcome-$s.png" > /dev/null
  done
  echo "  review/$L-welcome-0..5.png"
  # Diagnostics (not uploaded to the store): app log lines and crash reports.
  mkdir -p "$OUT/logs"
  xcrun simctl spawn "$UDID" log show --last 30m --style compact \
    --predicate 'process == "Snuffel" AND (messageType == error OR messageType == fault OR subsystem == "com.facebook.react.log")' \
    > "$OUT/logs/$L-app.log" 2>&1 || true
  cp ~/Library/Logs/DiagnosticReports/Snuffel* "$OUT/logs/" 2>/dev/null || true
  xcrun simctl shutdown "$UDID"
  xcrun simctl delete "$UDID"
done
