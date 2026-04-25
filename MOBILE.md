# SAB Tracker — Android app

A thin Capacitor wrapper around the live web app at
[https://pulse.indefine.in](https://pulse.indefine.in). Employees install
the APK, sign in once, and get a punch-in / punch-out experience that
looks like a native app.

This is **Android-only** for now. iOS is future work.

---

## How to download the APK

The APK is rebuilt automatically by GitHub Actions on every push to `main`
that touches mobile code. To grab the latest:

1. Open the repo on GitHub:
   [Laaxxmm/installation_industry_tracker](https://github.com/Laaxxmm/installation_industry_tracker)
2. Click the **Actions** tab.
3. In the left sidebar, click **Build Android APK**.
4. Open the most recent green ✓ run.
5. Scroll to the **Artifacts** section at the bottom.
6. Click `sab-tracker-debug-apk` → downloads a ZIP.
7. Unzip → you'll have `app-debug.apk` (~5–8 MB).

If the most recent run is red ✗, look at the previous green one or
trigger a fresh build via **Run workflow** → **Run workflow** on the
right-hand side.

To force a fresh build without pushing code: click **Run workflow** on
the same page and pick branch `main`.

---

## How to install on a phone (sideload)

Android blocks installs from outside the Play Store by default. One-time
setup per phone:

1. Transfer `app-debug.apk` to the phone — any of:
   - USB cable + drag to `Downloads/`
   - Google Drive / OneDrive shared link
   - WhatsApp self-message (works for files up to 100 MB)
   - Email attachment to yourself
2. On the phone, open the file manager (e.g. **Files by Google**) and
   tap `app-debug.apk`.
3. Android will prompt: *"For your security, your phone is not allowed
   to install unknown apps from this source."* Tap **Settings**, enable
   **Allow from this source**, then go back.
4. Tap **Install**. After install, tap **Open**.
5. The SAB orange icon appears in the app drawer — long-press → **Add to
   Home screen** for quick access.

If the user previously had a Cloudflare-tunnel build of the app
installed, the new APK should upgrade it cleanly. If you see
`INSTALL_FAILED_UPDATE_INCOMPATIBLE`, **uninstall the old SAB Tracker
app first**, then install the new one.

---

## First login

After install, the WebView loads `https://pulse.indefine.in/login`. Sign
in with the user's regular email + password — same credentials they'd
use on a desktop browser. The session cookie is stored in the WebView's
cookie jar, so they only need to sign in once per app install.

The app deep-links to `/punch` after login, which shows the
punch-in / punch-out widget plus a list of recent entries.

> **Role note:** ADMIN users are redirected to `/dashboard` if they hit
> `/punch` (admins typically don't punch). For real punch-in testing,
> create an EMPLOYEE user via `/admin/users` on a desktop, then sign in
> as that user on the phone.

---

## What works inside the WebView

| Feature | Path | Status |
|---|---|---|
| Punch in / out | `/punch` | ✅ |
| My timesheet | `/me` | ✅ |
| Profile | `/profile` | ✅ |
| AMC site visits | `/mobile/amc` | ✅ |
| Service-call visits | `/mobile/service` | ✅ |
| Photo upload during punches/visits | (file picker) | ✅ |
| Camera capture for site photos | (browser `<input capture>`) | ✅ |

Everything is server-rendered by Next.js — every action that creates a
record (punch, photo, AMC checklist, service visit) hits Postgres
directly through the existing API routes. No background sync, no offline
queue.

---

## Offline behaviour

If the phone has no signal when the app launches, the WebView falls back
to `dist-mobile/index.html` — a small "Can't reach the server" page with
a **Tap to retry** button.

If the phone goes offline *during* use, the WebView's currently-loaded
page stays on screen but any new action that needs the server will hang
or error. There is no offline punch-in queue. Workarounds:

- Punch in/out from a desktop / different phone with signal
- Wait for signal and refresh the page

---

## Updating the app

Every push to `main` that touches `capacitor.config.ts`, `android/`,
`dist-mobile/`, `package.json`, or this workflow file produces a new
APK. To distribute:

1. Download the new APK from the Actions tab as above.
2. Send it to staff via the same channel they got the original.
3. They install over the top — the version bump in `android/app/build.gradle`
   means Android treats it as an upgrade.

For most app changes you don't need a new APK at all — the WebView
fetches `pulse.indefine.in` fresh on every launch, so any web-side
deploy is automatically picked up by every installed app within seconds.

You only need a new APK when one of these changes:
- The Capacitor config (`server.url`, `allowNavigation`, plugins)
- The Android-side resources (icon, splash, manifest, permissions)
- Native plugin versions / Capacitor itself
- The Android `versionCode` / `versionName`

---

## Future work — not in this build

- **Play Store distribution.** Requires a long-lived `keystore.jks` and
  a `signingConfigs.release` block in `android/app/build.gradle`. Worth
  doing once the user count is large enough that sideloading becomes
  painful.
- **iOS app.** Capacitor supports iOS, but we'd need to scaffold an
  Xcode project and pay for an Apple Developer account ($99/year).
- **Offline-queue punch-ins.** Would let employees clock in on a
  no-signal site and have the entry submitted once they're back online.
  Real engineering effort — needs a service worker + sync logic.
- **Push notifications.** The Android manifest already declares the
  permissions, but we'd need to wire up FCM (`google-services.json`)
  and a server-side push integration.

---

## Troubleshooting

**"App not installed"** when sideloading the new APK over the old one
→ uninstall the old SAB Tracker first, then install the new one. (The
debug keystore changes between CI runs.)

**The app opens to the offline fallback every time, even with signal**
→ check that `https://pulse.indefine.in` resolves on the phone's
browser. If yes, force-quit the app and reopen. If still failing, check
the Capacitor `server.url` in `capacitor.config.ts` matches the URL
you're trying to reach.

**Login succeeds on desktop but says "Invalid credentials" in the app**
→ email match is case-sensitive. Make sure the user types their email
in the exact case it was created with (visible at `/admin/users`).

**The app shows a blank white screen on launch**
→ the WebView didn't reach the server and didn't fall back to
`dist-mobile/index.html`. Usually means the network call hung. Force-quit,
make sure the phone has signal, retry. If it persists, the latest CI
build may be broken — check the Actions tab for a green run.
