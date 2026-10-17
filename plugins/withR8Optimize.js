// R8 with optimisation in release builds. Expo's minify setting uses Google's
// "proguard-android.txt", which switches optimisation off (-dontoptimize); Play
// recommends the optimising default ("proguard-android-optimize.txt"). React
// Native, Expo modules and MapLibre ship their own keep rules for reflection.
const { withAppBuildGradle } = require("expo/config-plugins");

module.exports = function withR8Optimize(config) {
  return withAppBuildGradle(config, (cfg) => {
    const before = cfg.modResults.contents;
    const after = before.replace(/getDefaultProguardFile\(\s*["']proguard-android\.txt["']\s*\)/g,
      'getDefaultProguardFile("proguard-android-optimize.txt")');
    if (after === before && !before.includes("proguard-android-optimize.txt")) {
      throw new Error("withR8Optimize: no getDefaultProguardFile(\"proguard-android.txt\") in app/build.gradle - check the template");
    }
    cfg.modResults.contents = after;
    return cfg;
  });
};
