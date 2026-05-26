# Last Puff Mobile

This folder is the Android app wrapper for the existing `chaos-control-central` UI.

## What it does

- Keeps the same screens, routes, and styling as the current app
- Packages the web app inside a native Android shell with Capacitor
- Builds a debug APK without needing Android Studio

## Backend config

Set `VITE_API_BASE_URL` before building if the backend is not reachable at the default address.

Example:

```powershell
Copy-Item .env.example .env
```

Then edit `.env` and point it to your backend, for example:

```env
VITE_API_BASE_URL=http://192.168.1.10:5000
```

Notes:

- `10.0.2.2:5000` is used automatically for Android emulator builds
- A real phone usually needs your computer's LAN IP, not `localhost`

## Commands

```powershell
npm install
npm run android:add
npm run build:apk
```

Expected APK path after success:

`android\app\build\outputs\apk\debug\app-debug.apk`
