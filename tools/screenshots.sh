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

shot() {   # shot <lang> <name> <url> <seconds to settle>
  xcrun simctl openurl "$UDID" "$3"
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
  xcrun simctl launch "$UDID" "$BUNDLE" -AppleLanguages "($L)" -AppleLocale "$LOCALE" -SnuffelDemo YES > /dev/null
  sleep 25   # first start: map style, place data, demo data incl. one AI answer
  echo "$L:"
  shot "$L" 1-find      "snuffel:///?near=1&view=list" 14
  shot "$L" 2-emergency "snuffel:///emergency" 14
  shot "$L" 3-map       "snuffel:///?near=1&view=map" 16
  shot "$L" 4-ask       "snuffel:///ask" 6
  shot "$L" 5-dog       "snuffel:///dog/1" 5
  shot "$L" 6-saved     "snuffel:///saved" 5
  xcrun simctl shutdown "$UDID"
  xcrun simctl delete "$UDID"
done
