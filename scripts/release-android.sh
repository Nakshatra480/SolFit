#!/usr/bin/env bash
# Builds and checks a SolFit release APK. It never publishes anything: the output goes to
# dist/ for review, and publishing is a separate, manual step (see docs/RELEASING.md).
#
# Needs: JDK 17, the Android SDK, and the release key configured in ~/.gradle/gradle.properties
# (SOLFIT_UPLOAD_STORE_FILE / _STORE_PASSWORD / _KEY_ALIAS / _KEY_PASSWORD). Without that key the
# build would fall back to the debug key, so this script refuses to run.
set -euo pipefail
cd "$(dirname "$0")/.."

AUTH_URL="https://solfit-auth.onrender.com"
PACKAGE="com.solfit.app"
export JAVA_HOME="${JAVA_HOME_17:-/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"
BT="$ANDROID_HOME/build-tools/36.0.0"

grep -q '^SOLFIT_UPLOAD_STORE_FILE=' ~/.gradle/gradle.properties 2>/dev/null \
  || { echo "Release key not configured in ~/.gradle/gradle.properties; refusing to build a debug-signed release."; exit 1; }

echo "== 1. Checks"
npx tsc --noEmit -p .
npm --prefix functions test >/dev/null && echo "unit tests: pass"

echo "== 2. Build (JS bundled into the APK; sign-in server $AUTH_URL)"
rm -f android/app/build/outputs/apk/release/app-release.apk
# Set here so the release bundle never depends on a local .env.
# Phones only: arm64-v8a and armeabi-v7a (x86 builds are for emulators and roughly double the size).
(cd android && EXPO_PUBLIC_AUTH_URL="$AUTH_URL" NODE_ENV=production ./gradlew assembleRelease \
  -PreactNativeArchitectures=arm64-v8a,armeabi-v7a --console=plain -q)
APK=android/app/build/outputs/apk/release/app-release.apk

echo "== 3. Signature"
"$BT/apksigner" verify --print-certs "$APK" | grep -E 'Signer #1 certificate (DN|SHA-256)'
if "$BT/apksigner" verify --print-certs "$APK" | grep -q 'CN=Android Debug'; then
  echo "APK is debug-signed; stopping."; exit 1
fi

echo "== 4. Package, version, endpoint"
BADGE=$("$BT/aapt2" dump badging "$APK" | sed -n 1p || true)
echo "$BADGE"
echo "$BADGE" | grep -q "name='$PACKAGE'" || { echo "wrong package id"; exit 1; }
VERSION=$(echo "$BADGE" | sed -E "s/.*versionName='([^']+)'.*/\1/")
BUNDLE=$(mktemp -d)
unzip -q -o "$APK" 'assets/index.android.bundle' -d "$BUNDLE"
# The bundle is Hermes bytecode, so search it as binary (-a).
grep -aq "$AUTH_URL" "$BUNDLE/assets/index.android.bundle" && echo "bundle uses $AUTH_URL" \
  || { echo "sign-in URL missing from bundle; stopping."; exit 1; }
if grep -aq "kinlog-6549a" "$BUNDLE/assets/index.android.bundle"; then echo "bundle points at the original Kinlog backend; stopping."; exit 1; fi
# Library constants that are always present and never called in release: React Native's dev-server
# and emulator hosts (localhost:8081, 10.0.2.2, 127.0.0.1) and web3.js's localnet (localhost:8899).
if grep -aEo 'https?://(localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\.)[0-9.:]*' "$BUNDLE/assets/index.android.bundle" \
    | grep -vxE 'http://(localhost:8081|localhost:8899|10\.0\.2\.2|127\.0\.0\.1)' | grep -q .; then
  echo "WARNING: bundle mentions an unexpected local address; review before publishing"
fi
for f in solfit-auth.json google-application-credentials private_key AUTH_NONCE_SECRET; do
  if grep -aq "$f" "$BUNDLE/assets/index.android.bundle"; then echo "bundle contains '$f'; stopping."; exit 1; fi
done
rm -rf "$BUNDLE"

echo "== 5. Artifact"
mkdir -p dist
OUT="dist/solfit-android-$VERSION.apk"
cp "$APK" "$OUT"
shasum -a 256 "$OUT" | tee "$OUT.sha256"
ls -lh "$OUT" | awk '{print "size:", $5}'
echo "Ready for review: $OUT (not published)"
