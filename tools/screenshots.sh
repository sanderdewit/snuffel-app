#!/usr/bin/env bash
# App Store screenshots on an iOS simulator (macOS CI runner).
#   tools/screenshots.sh <path to Snuffel.app> <output dir> [languages...]
# 6.9" iPhone (1320 x 2868), the size App Store Connect requires; smaller
# iPhones reuse it. Location: Amsterdam. The app runs in screenshot mode
# (-SnuffelDemo YES: sample dog, reminders, my vet, one real AI answer).
set -euo pipefail
APP="$1"; OUT="$2"; shift 2
LANGS=("${@:-nl en}")
BUNDLE=app.snuffel
LAT=52.3600; LON=4.8852

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

launch() {   # launch <lang> [route]
  xcrun simctl terminate "$UDID" "$BUNDLE" > /dev/null 2>&1 || true
  xcrun simctl launch "$UDID" "$BUNDLE" -AppleLanguages "($1)" -AppleLocale "$LOCALE" -SnuffelDemo YES \
    ${2:+-SnuffelDemoRoute "$2"} > /dev/null
}
# Each screen: restart the app at that route (links would trigger iOS's
# "Open in Snuffel?" prompt).
shot() {   # shot <lang> <name> <route> <seconds to settle>
  launch "$1" "$3"
  sleep "$4"
  xcrun simctl io "$UDID" screenshot "$OUT/$1/$2.png" > /dev/null
  echo "  $1/$2.png"
}

for L in ${LANGS[@]}; do
  case "$L" in nl) LOCALE=nl_NL ;; en) LOCALE=en_GB ;; *) LOCALE="${L}_$(echo "$L" | tr a-z A-Z)" ;; esac
  mkdir -p "$OUT/$L"
  UDID=$(xcrun simctl create "snuffel-$L" "$DEVICE_TYPE" "$RUNTIME")
  xcrun simctl boot "$UDID"
  xcrun simctl bootstatus "$UDID" -b > /dev/null
  xcrun simctl status_bar "$UDID" override --time "9:41" --dataNetwork wifi --wifiBars 3 --cellularMode active --cellularBars 4 --batteryState charged --batteryLevel 100
  xcrun simctl location "$UDID" set "$LAT,$LON"
  xcrun simctl install "$UDID" "$APP"
  xcrun simctl privacy "$UDID" grant location "$BUNDLE"
  launch "$L"
  sleep 30   # first start: place data, demo data incl. one AI answer
  echo "$L:"
  shot "$L" 1-find      "/?near=1&view=list" 16
  shot "$L" 2-emergency "/emergency" 16
  shot "$L" 3-map       "/?near=1&view=map" 20
  shot "$L" 4-ask       "/ask" 8
  shot "$L" 5-dog       "/dog/1" 8
  shot "$L" 6-file      "/dog/file/1" 8
  shot "$L" 7-saved     "/saved" 8
  # Diagnostics (not uploaded to the store): app log lines and crash reports.
  mkdir -p "$OUT/logs"
  xcrun simctl spawn "$UDID" log show --last 30m --style compact \
    --predicate 'process == "Snuffel" AND (messageType == error OR messageType == fault OR subsystem == "com.facebook.react.log")' \
    > "$OUT/logs/$L-app.log" 2>&1 || true
  cp ~/Library/Logs/DiagnosticReports/Snuffel* "$OUT/logs/" 2>/dev/null || true
  xcrun simctl shutdown "$UDID"
  xcrun simctl delete "$UDID"
done
