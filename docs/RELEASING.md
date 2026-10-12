# Releasing the SolFit Android app

The public APK is a GitHub Release asset in the public repo `Nakshatra480/solfit-releases`, which
holds releases only (no source). The website links to its stable "latest" URL:

    https://github.com/Nakshatra480/solfit-releases/releases/latest/download/solfit-android.apk

## Signing key: do not lose it

- Keystore: `~/.config/solfit/solfit-release.jks` (alias `solfit-upload`, RSA 4096, valid to 2054).
- Passwords: `~/.gradle/gradle.properties` (`SOLFIT_UPLOAD_*`), mode 600, never in the repo.
- Certificate SHA-256: `D0:2B:DC:B6:96:E1:1B:28:76:02:8C:36:AF:26:B5:75:16:2D:DB:F1:FA:21:5B:CC:2F:C1:DC:0A:BC:1F:70:F2`
  (also in `docs/.well-known/assetlinks.json`).
- Every update must be signed with this key, or Android refuses to install it over the old one and
  users have to uninstall first. Keep an offline backup of the keystore file and the two
  `SOLFIT_UPLOAD_*_PASSWORD` values together, in a password manager or encrypted drive.

## Steps

1. Bump `versionCode` (+1) and `versionName` in `android/app/build.gradle`, and `version` /
   `android.versionCode` in `app.json` to match.
2. `scripts/release-android.sh` runs the TypeScript check and unit tests, builds the signed release
   APK with `EXPO_PUBLIC_AUTH_URL=https://solfit-auth.onrender.com`, refuses a debug-signed or
   wrong-package build, checks the bundle for the production URL and for secrets, and writes
   `dist/solfit-android-<version>.apk` plus its `.sha256`. It publishes nothing.
3. On a phone: install the APK (`adb install -r dist/solfit-android-<version>.apk`), open it with no
   Metro running, connect a wallet and sign in, run a full workout with the camera.
4. Publish (needs the owner's go-ahead):
   `gh release create v<version> dist/solfit-android-<version>.apk#solfit-android.apk -R Nakshatra480/solfit-releases --title "SolFit <version>" --notes-file <notes>`
   (upload under the name `solfit-android.apk` so the stable URL keeps working).
5. Update `docs/index.html`: version, size, date, SHA-256 and release notes. Commit and push.
6. Check from a phone's browser that the Download button fetches the new file and installs over the
   previous version.

## Known limits

- The sign-in server is a Render free instance: it sleeps after 15 minutes idle and takes about a
  minute to wake (42 s measured on 2026-10-12). The app waits up to 75 s for the first request.
- The app needs the network to sign in and to save workouts.
