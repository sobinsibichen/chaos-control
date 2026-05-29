# Last Puff Mobile

This folder is the Android app wrapper for the existing `chaos-control-central` UI.

## What it does

- Keeps the same screens, routes, and styling as the current app
- Packages the web app inside a native Android shell with Capacitor
- Builds a debug APK without needing Android Studio

## Backend config

Set `VITE_API_BASE_URL` before building if you want to override the bundled production backend URL.

Example:

```powershell
Copy-Item .env.example .env
```

Then edit `.env` and point it to your backend, for example:

```env
VITE_API_BASE_URL=https://chaos-control-api.onrender.com
```

Notes:

- The app defaults to `https://chaos-control-api.onrender.com`
- Override the value only if you are testing against another backend

## Commands

```powershell
npm install
npm run android:add
npm run build:apk
```

Expected APK path after success:

`%LOCALAPPDATA%\LastPuff\android-build\app\outputs\apk\debug\app-debug.apk`

Note:

- The Gradle build directory is redirected out of the repo, so `android\app\build` can look stale
- If you want the exact copied APK path after a build, use the path above
