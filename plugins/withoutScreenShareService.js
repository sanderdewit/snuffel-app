// The WebRTC library (@livekit/react-native-webrtc) declares a screen-sharing
// foreground service (foregroundServiceType="mediaProjection"). Snuffel only
// uses audio, and Play asks questions about declared foreground services, so
// the merged manifest drops it (tools:node="remove").
const { withAndroidManifest } = require("expo/config-plugins");

const SERVICE = "com.oney.WebRTCModule.MediaProjectionService";

module.exports = function withoutScreenShareService(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.$ = manifest.$ || {};
    manifest.$["xmlns:tools"] = manifest.$["xmlns:tools"] || "http://schemas.android.com/tools";
    const app = manifest.application && manifest.application[0];
    if (!app) throw new Error("withoutScreenShareService: no <application> in AndroidManifest.xml");
    app.service = (app.service || []).filter((s) => s.$["android:name"] !== SERVICE);
    app.service.push({ $: { "android:name": SERVICE, "tools:node": "remove" } });
    return cfg;
  });
};
