# Mobile App Setup Guide

---

## Step 0 — Firebase Setup (required for Android push notifications)

Android push notifications require a `google-services.json` file from your Firebase project.

### Create the Android app in Firebase

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Open your project (or create one)
3. Click **Add app → Android**
4. **Android package name:** `et.abaydriver.app`
5. App nickname: `Abay Driver` (optional)
6. Click **Register app**
7. **Download `google-services.json`**
8. Place it in: `mobile/google-services.json`

### Enable Cloud Messaging

1. In Firebase Console → **Project Settings → Cloud Messaging**
2. Make sure **Firebase Cloud Messaging API (V1)** is enabled
3. Copy the **Server key** — you'll need it if you ever send notifications from outside Expo

That's all — Expo's push service talks to FCM automatically using this file.

### (Optional) iOS push notifications

For iOS you also need:
1. An **Apple Developer account** ($99/year)
2. In Firebase → **Project Settings → Apple apps → Add app**
3. iOS bundle ID: `et.abaydriver.app`
4. Upload your **APNs Auth Key** from Apple Developer Portal
5. Download `GoogleService-Info.plist` → place in `mobile/GoogleService-Info.plist`

---

Complete checklist for getting the Abay Driver mobile app built and running on real devices.

---

## Prerequisites

```bash
npm install -g eas-cli expo-cli
```

---

## Step 1 — Google Maps API Key

The app uses Google Maps for turn-by-turn navigation and route polylines.

### Get a key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or select an existing one)
3. Enable these APIs:
   - **Maps SDK for Android**
   - **Maps SDK for iOS**
   - **Directions API**
4. Go to **Credentials → Create Credentials → API Key**
5. (Recommended) Restrict the key:
   - Android: restrict by package name `et.abaydriver.app`
   - iOS: restrict by bundle ID `et.abaydriver.app`

### Wire it in

Replace `YOUR_GOOGLE_MAPS_API_KEY` in **three places**:

**`mobile/app.json`**
```json
"ios": {
  "config": { "googleMapsApiKey": "AIzaSy..." }
},
"android": {
  "config": { "googleMaps": { "apiKey": "AIzaSy..." } }
},
"extra": {
  "googleMapsApiKey": "AIzaSy..."
}
```

**`mobile/.env`** (copy from `.env.example` first)
```
GOOGLE_MAPS_API_KEY=AIzaSy...
```

---

## Step 2 — Expo Account & EAS Project

Push notifications on real devices require an EAS project ID.

### Create account and project

```bash
# 1. Create a free account at https://expo.dev if you don't have one

# 2. Log in
eas login

# 3. Inside the mobile/ directory, initialise the project
cd mobile
eas init
# This adds your projectId to app.json automatically
```

### Update app.json manually (if eas init doesn't do it)

```json
"extra": {
  "googleMapsApiKey": "AIzaSy...",
  "eas": {
    "projectId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  }
},
"owner": "your-expo-username"
```

---

## Step 3 — Update eas.json

Open `mobile/eas.json` and set your production API URL:

```json
"production": {
  "android": { "buildType": "app-bundle" },
  "env": {
    "API_BASE_URL": "https://api.abaydriver.et"
  }
}
```

For development, set your machine's local IP (find with `ifconfig` / `ipconfig`):

```json
"development": {
  "env": {
    "API_BASE_URL": "http://192.168.x.x:5000"
  }
}
```

---

## Step 4 — Build

### Development build (installs on your physical device via Expo Go or dev client)

```bash
cd mobile
eas build --profile development --platform android
# or: --platform ios
```

### Preview APK (share with testers)

```bash
eas build --profile preview --platform android
# Produces an .apk you can install directly
```

### Production (Google Play / App Store)

```bash
eas build --profile production --platform android
eas build --profile production --platform ios
```

---

## Step 5 — Submit to stores (optional)

### Android (Google Play)

1. Create a service account key in Google Play Console
2. Save it as `mobile/google-play-service-account.json`
3. Update `eas.json` submit section with your `track` (internal/alpha/beta/production)

```bash
eas submit --platform android --profile production
```

### iOS (App Store)

Fill in `eas.json` submit section:
```json
"ios": {
  "appleId": "you@example.com",
  "ascAppId": "1234567890",
  "appleTeamId": "XXXXXXXXXX"
}
```

```bash
eas submit --platform ios --profile production
```

---

## Step 6 — Over-the-Air Updates (EAS Update)

After initial build you can push JS-only fixes without a new store release:

```bash
eas update --branch production --message "Fix order status display"
```

---

## Environment Variable Summary

| Variable | Where | Description |
|---|---|---|
| `GOOGLE_MAPS_API_KEY` | `app.json` (×3) + `.env` | Maps navigation & Directions API |
| `EAS_PROJECT_ID` | `app.json → extra.eas.projectId` | Expo push notifications |
| `API_BASE_URL` | `eas.json → env` per profile | Backend URL for each build type |

---

## Troubleshooting

**Push notifications not working**
- Confirm `extra.eas.projectId` in `app.json` matches your project at expo.dev
- On Android, confirm `google-services.json` is present for local builds

**Map not loading**
- Check the API key has Maps SDK for Android/iOS enabled in Google Cloud Console
- Confirm the package/bundle ID restriction matches `et.abaydriver.app`

**Build fails on `expo-location` background permission**
- Ensure `ACCESS_BACKGROUND_LOCATION` is in `android.permissions` in `app.json` ✓ (already added)
