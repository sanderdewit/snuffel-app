#!/usr/bin/env bash
# Google Play screenshots on an Android emulator (CI, inside android-emulator-runner).
#   tools/screenshots-android.sh <screenshot-build.apk> <output dir> [languages...]
# The APK must be the screenshot build (EXPO_PUBLIC_SNUFFEL_DEMO=1): sample dog,
# reminders, my vet and one real AI answer. Device: 1080 x 1920 (16:9), because
# Google Play refuses screenshots longer than 2:1. Location: Amsterdam.
set -euo pipefail
APK="$1"; OUT="$2"; shift 2
LANGS=("${@:-nl en}")
PKG=app.snuffel

# "adb root" and a zygote restart drop the connection for a moment ("device
# offline"): wait until adb really reports a booted device again.
boot_wait() {
  for i in $(seq 1 90); do
    if [ "$(adb get-state 2>/dev/null)" = "device" ] && [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; then sleep 5; return 0; fi
    sleep 2
  done
  echo "device did not come back"; return 1
}
retry() { for i in 1 2 3 4 5; do "$@" && return 0; echo "retry $i: $*"; sleep 5; done; return 1; }
open() { adb shell "am start -W -a android.intent.action.VIEW -d '$1' $PKG" > /dev/null; }
shot() {   # shot <lang> <name> <app link> <seconds>
  open "$3"; sleep "$4"
  adb exec-out screencap -p > "$OUT/$1/$2.png"
  echo "  $1/$2.png"
}

echo "== root"; adb root || true; sleep 3; boot_wait
echo "== install $APK"; retry adb install -r "$APK"
adb shell settings put secure location_mode 3
adb shell settings put global sysui_demo_allowed 1

for L in ${LANGS[@]}; do
  case "$L" in nl) LOC=nl-NL ;; en) LOC=en-GB ;; *) LOC="$L-$(echo "$L" | tr a-z A-Z)" ;; esac
  mkdir -p "$OUT/$L"
  adb shell pm clear "$PKG" > /dev/null
  echo "== language $LOC"
  adb shell "setprop persist.sys.locale $LOC; setprop ctl.restart zygote" || true; sleep 5; boot_wait
  adb shell pm grant "$PKG" android.permission.ACCESS_FINE_LOCATION
  adb shell pm grant "$PKG" android.permission.ACCESS_COARSE_LOCATION
  adb emu geo fix 4.8852 52.3600 > /dev/null
  # Clean status bar: 9:41, full battery, full signal, no notification icons.
  for c in "enter" "clock -e hhmm 0941" "battery -e level 100 -e plugged false" "network -e wifi show -e level 4 -e mobile show -e datatype none -e level 4" "notifications -e visible false"; do
    adb shell "am broadcast -a com.android.systemui.demo -e command $c" > /dev/null
  done
  adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 > /dev/null 2>&1
  sleep 40   # first start: place data, demo data incl. one AI answer
  adb emu geo fix 4.8852 52.3600 > /dev/null
  echo "$L:"
  shot "$L" 1-find      "snuffel:///?near=1&view=list" 16
  shot "$L" 2-emergency "snuffel:///emergency" 16
  shot "$L" 3-map       "snuffel:///?near=1&view=map" 20
  shot "$L" 4-ask       "snuffel:///ask" 8
  shot "$L" 5-dog       "snuffel:///dog/1" 8
  shot "$L" 6-file      "snuffel:///dog/file/1" 8
  shot "$L" 7-saved     "snuffel:///saved" 8
  mkdir -p "$OUT/logs"
  adb logcat -d -s ReactNativeJS:V AndroidRuntime:E > "$OUT/logs/$L-logcat.txt" || true
  adb logcat -c || true
done
