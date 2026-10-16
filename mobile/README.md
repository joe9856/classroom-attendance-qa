# Classroom Attendance — Android / Expo Snack

Recovered from https://snack.expo.dev/@natchapon98/project_react on 2026-10-16 (Asia/Bangkok). This is the classroom application connected to Firebase project `finalprojectsc362202`. The separately supplied `surprised-orange-apple` Snack is a camera exercise and was not changed.

## Open on Android

This recovery targets Expo SDK 55, the highest SDK offered by the Snack editor when checked. Use a matching Expo Go build:

https://expo.dev/go?sdkVersion=55&platform=android&device=true

Open the Classroom Snack and select **Run on device** to display its QR code. An Expo Go build for a different SDK may reject the project. This source has no custom `runtimeVersion`, so the Snack can use its matching Expo Go runtime.

## Run the recovered source locally

```sh
cd mobile
npm ci
npm start
```

To check Android bundling without building an APK:

```sh
npm run export:android
```

The `dist` output is a JavaScript/Hermes bundle and assets, not an installable APK. A native APK requires a separate native build.

## Repairs

- Upgrade the runtime and native dependencies from SDK 52 to compatible SDK 55 versions; retain a package lock for reproducible local installs.
- Use the official Firebase 12 entry packages `@firebase/app-compat@0.5.0`, `@firebase/auth-compat@0.6.0`, and `@firebase/firestore-compat@0.4.0`. These are the versions distributed by `firebase@12.0.0`, and avoid Snack's inability to bundle the empty root entry of the umbrella `firebase` package. Existing Firestore collection paths and document shapes remain supported.
- Load the gesture handler before navigation and provide its root view.
- Prevent the placeholder Google Client ID from starting an invalid OAuth request when the login screen mounts. Correct the Google credential provider reference and pass serializable user details between screens.
- Save registration profile fields used by the website as well as the older mobile field names.
- Remove broken links to an unregistered classroom detail screen and an undefined approval callback. Reuse the existing Check In and Answer Questions actions.
- Refresh classroom listeners through effect cleanup instead of leaking a new listener on every refresh. Handle a missing check-in user without changing hook order.

## Authentication

Email/password authentication uses the existing Firebase project and accounts. No test accounts were created and no classroom, student, or attendance records were changed during verification.

The original Google configuration was the literal `YOUR_GOOGLE_CLIENT_ID`; it was not a working OAuth configuration. Google login in a standalone/development app requires real platform client IDs in `googleClientIds` in `LoginScreen.js` and an appropriate native redirect configuration. Until that is configured, the app explains that email/password should be used. Google OAuth with a custom native redirect cannot be tested in Expo Go.

Website Google login is configured separately. The owner added `joe9856.github.io` under Firebase Authentication > Settings > Authorized domains, and the public configuration response confirmed the change. The in-app browser could not complete Google popup testing because of `auth/network-request-failed`.

## Verification

- Expo dependency compatibility check passed.
- Firebase initialization, email authentication methods, Firestore collection methods, and Google credential creation passed a local API smoke check without sending authentication requests.
- Android production export passed (1,060 modules with the final Firebase adapter).
- A production web export passed (848 modules), and the login/registration form rendered and switched correctly in a local browser with no runtime console errors.
- The repaired Snack was saved and reopened with SDK 55 and the intended source files. Its package bundling errors were resolved; the older screens version intentionally produces an SDK recommendation warning. The in-app browser's embedded Snack preview remained loading, so physical Android execution has not been verified.

Signing into a real account, camera permissions/scanning on a physical phone, and actual classroom/check-in writes still require functional checks by an authorized user.

## Snack dependency files

Snack manages Expo, React, React Native, and its web renderer through the SDK selector. Its editable `package.json` therefore contains the app's third-party dependencies only. The local package file additionally includes the core runtime dependencies and scripts needed outside Snack.

Snack's cloud bundler currently fails on the namespaced codegen types in `react-native-screens@4.23.0` (`accessibilityContainerViewIsModal`). Its cloud dependency list uses `4.17.0`, which the Snack bundler resolves successfully, while the local/native package file retains Expo 55's recommended `~4.23.0`. Snack also lists `expo-auth-session/providers/google` explicitly; local npm installs obtain that entry point from `expo-auth-session`.
