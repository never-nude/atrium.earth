# Atrium Traffic

A native macOS app that shows where atrium.earth's visitors come from. It reads
the Google Analytics 4 property the site already reports to (`public/analytics.js`),
so nothing on the website changes and the existing history is available at once.

| View | What it answers |
| --- | --- |
| Overview | Visitors, sessions and page views for the period, with top sources and places |
| Live | Who is on the site in the last 30 minutes, where they are and what they are viewing |
| Sources | Source, medium and campaign of each session |
| Referring pages | The exact outside URL a visitor came from and the Atrium page they opened |
| Places | City, region and country |
| Landing pages | First page of each session and what sent the visitor there |
| Devices | Device, system, browser and language |
| Activity log | Minute-by-minute rows: time, city, source, landing page, device |

Every table filters as you type and copies out as tab-separated text.

## Build

Requires macOS 14 and Xcode 15 or later (or its command line tools).

```bash
cd apps/AtriumTraffic && ./scripts/build-app.sh
```

```bash
open "build/Atrium Traffic.app"
```

To work on it in Xcode, open `apps/AtriumTraffic/Package.swift`.

## One-time Google setup

The app signs in as you with read-only Analytics access. Google requires your own
OAuth client for that:

1. In the [Google Cloud console](https://console.cloud.google.com/), create a project (any name).
2. Enable the two APIs:

   ```bash
   gcloud services enable analyticsdata.googleapis.com analyticsadmin.googleapis.com --project YOUR_PROJECT_ID
   ```

3. Under **Google Auth Platform → Branding**, fill in the consent screen with audience
   **External**, then under **Audience** press **Publish app**. Left in *Testing*,
   Google expires the sign-in every seven days. You will see an "unverified app"
   notice when signing in; that is expected for a personal client.
4. Under **Clients**, create an OAuth client of type **Desktop app**.
5. Paste its client ID and secret into the app and press **Sign in with Google**,
   using the Google account that owns the Atrium Analytics property.

The client secret and the sign-in token are stored in the macOS keychain. Nothing
is written to this repository. Because the app is signed ad hoc, macOS asks for
keychain permission again after each rebuild.

## What Google Analytics can and cannot tell you

- Location is city-level. IP addresses and individual identities are never available.
- A referring page is the full URL only when the visitor's browser sends it. Most
  browsers send just the site (`https://example.com/`) on cross-site links.
- Visitors with ad or tracker blockers are not counted.
- If **Google signals** is enabled on the property, Google withholds rows with very
  few visitors. The table footer says when that happened; turning signals off in
  Analytics Admin → Data collection removes the thresholding.
- Standard reports lag by a few hours. The Live view is immediate.
