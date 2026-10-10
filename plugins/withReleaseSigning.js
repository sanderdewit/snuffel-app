// Expo config plugin: Android release builds are signed with the Play upload
// key when CI provides it (environment variables below), otherwise with the
// debug key as Expo's template does. The key itself never enters the repo.
//   SNUFFEL_UPLOAD_STORE_FILE      path to the PKCS12 keystore
//   SNUFFEL_UPLOAD_STORE_PASSWORD  keystore + key password
//   SNUFFEL_UPLOAD_KEY_ALIAS       key alias
const { withAppBuildGradle } = require("expo/config-plugins");

const MARKER = "// snuffel: upload signing";

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;
    if (gradle.includes(MARKER)) return cfg;
    gradle = gradle.replace(/signingConfigs\s*\{/, `signingConfigs {
        ${MARKER}
        upload {
            def f = System.getenv("SNUFFEL_UPLOAD_STORE_FILE")
            if (f) {
                storeFile file(f)
                storeType "pkcs12"
                storePassword System.getenv("SNUFFEL_UPLOAD_STORE_PASSWORD")
                keyAlias System.getenv("SNUFFEL_UPLOAD_KEY_ALIAS")
                keyPassword System.getenv("SNUFFEL_UPLOAD_STORE_PASSWORD")
            }
        }`);
    // In the release build type only: use the upload key when it is configured.
    gradle = gradle.replace(/(release\s*\{[^}]*?)signingConfig signingConfigs\.debug/,
      '$1signingConfig System.getenv("SNUFFEL_UPLOAD_STORE_FILE") ? signingConfigs.upload : signingConfigs.debug');
    cfg.modResults.contents = gradle;
    return cfg;
  });
};
