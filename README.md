# Classroom Attendance (web)

React / Create React App website for classroom management, attendance, and questions. Authentication and classroom data use Firebase project `finalprojectsc362202`.

Website: https://joe9856.github.io/classroom-attendance-qa/

## Run locally

```sh
npm ci
npm start
```

Open the local URL printed by the development server. Firebase must allow the local hostname; `localhost` was already authorized when checked on 2026-10-16 (Asia/Bangkok).

## GitHub Pages outage diagnosed on 2026-10-16

The public repository previously named `project-react` now resolves to `joe9856/classroom-attendance-qa`. The old Pages URL returns HTTP 404.

The current Pages URL returns HTTP 200, but its deployed HTML still loads JavaScript and CSS from `/project-react/`. The JavaScript URL in that HTML returns HTTP 404, while the same file exists under `/classroom-attendance-qa/`. This prevents React from starting and leaves a blank page.

The `homepage` in `package.json` now matches the current Pages URL. The repaired build was published to `gh-pages` on 2026-10-16. The live HTML and all five referenced assets returned HTTP 200, and the login page rendered in the browser. The navbar login link was also changed to use React Router so navigation retains the repository path and hash routing.

Local verification after the repair: `npm ci` succeeded and `npm run build` completed with existing lint warnings. All five asset references in the generated HTML and all seven file entries in `asset-manifest.json` use `/classroom-attendance-qa/` and resolve to existing build files. Signed-in flows have not been tested because the Firebase domain setting remains unresolved.

## Restore Google sign-in

The public Firebase Auth configuration responds successfully, but its authorized domains did **not** include `joe9856.github.io` when checked. Google popup sign-in from this website requires that domain.

The Firebase Console was opened to apply the repair, but the signed-in account received "The project does not exist or you do not have permission to list apps in the project." A project owner must sign in before this setting can be changed. No Firebase permissions or rules have been changed.

An owner of the Firebase project should:

1. Open https://console.firebase.google.com/project/finalprojectsc362202/authentication/settings
2. In Authentication > Settings > Authorized domains, add `joe9856.github.io` (hostname only, without `https://` or the repository path).
3. Confirm that Google is enabled under Authentication > Sign-in method.

Reference: https://firebase.google.com/docs/auth/web/google-signin

The missing domain is a separate issue from the blank page. The Firebase configuration response does not establish that Firestore rules, quotas, or signed-in classroom access are working. Those require a signed-in functional check after publishing. No Firestore rules are stored in this repository.

## Publish the repaired web build

```sh
npm run build
npm run deploy
```

`deploy` already runs `build` through the `predeploy` script, so `npm run deploy` alone also builds before publishing. Publishing requires GitHub write access.

In GitHub Settings > Pages, confirm the publishing source is the `gh-pages` branch and its root folder when using this deployment script. After publication:

1. Open https://joe9856.github.io/classroom-attendance-qa/#/login and refresh.
2. Confirm the JavaScript and CSS requests use `/classroom-attendance-qa/` and return HTTP 200.
3. Sign in with an existing account, open a classroom, and verify the intended attendance workflow.

The app uses `HashRouter`; shared page URLs include `#/`, for example `#/login`. Keep hash routing for GitHub Pages unless a separate fallback strategy is configured.

Reference: https://create-react-app.dev/docs/deployment/#github-pages

## Expo / mobile

This checkout contains the web app. Although a tracked `.expo` directory exists, there is no Expo dependency, `app.json` / `app.config.*`, `eas.json`, or React Native mobile source. The mobile application's repository or folder is needed to check Expo SDK compatibility, Expo Go support, and its Firebase integration. Updating this web build does not update an installed mobile app.

The provided EAS project is https://expo.dev/accounts/natchapon98/projects/my-app. After the owner signed in on 2026-10-16, its overview showed no development or production builds, but it did show published updates. The inspected Android update `854cb450-f2f8-4f3b-81ba-ae94612b2c2b` ("Fix filename casing issues") was published on 2025-03-15 at 14:40 Asia/Bangkok. Its manifest endpoint still responds HTTP 200 and identifies Expo SDK `52.0.0` and runtime `1.0.0`.

SDK 52 is no longer supported by the latest Expo Go. If the phone uses current Expo Go, this is a compatibility issue to resolve separately from GitHub Pages. In addition, the inspected update specifies the custom runtime `1.0.0`; Expo documents that updates with `runtimeVersion` cannot be loaded in Expo Go and require a compatible development build. Installing an older Expo Go alone therefore does not establish that this particular update can run. The owner confirmed Android, but the exact installed client, phone error, and mobile source are still needed to verify and repair that application's behavior.

References:

- https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/
- https://docs.expo.dev/build/updates/#previewing-updates-in-development-builds
