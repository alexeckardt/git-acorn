# Releasing git-acorn

Auto-update is driven by **GitHub Releases**, not by branch pushes. Publishing a
release uploads the installers plus an update manifest (`latest.yml` /
`latest-mac.yml`); every running copy of the app checks that feed on launch,
notices the newer version, and prompts the user to download and restart.

The publish target lives in `package.json` under `build.publish` (the public
`alexeckardt/git-acorn` repo).

## One-time setup

- The repo (or at least its Releases) must be **public** so the app can read the
  update feed with no credentials.
- Create a GitHub token with `repo` scope and export it so `electron-builder` can
  upload assets:

  ```bash
  export GH_TOKEN=ghp_your_token_here
  ```

## Recommended: automated releases via CI

`.github/workflows/release.yml` builds and publishes for **all three platforms**
whenever a version tag is pushed — no need to build on each OS by hand.

1. **Cut a version tag.** Either:
   - **From the app:** right-click the commit you want to release → **Create
     tag…**, name it `vX.Y.Z`, leave **Push to origin** checked. Pushing the tag
     is what triggers the workflow. (Bump `package.json`'s `version` to match, so
     auto-update sees the new version.)
   - **From the terminal:**
     ```bash
     npm version patch        # bumps package.json + commits + tags vX.Y.Z
     git push --follow-tags
     ```

2. **Let CI run.** The matrix (macOS / Windows / Linux) builds each installer and
   publishes them to a single **draft** GitHub Release for the tag.

3. **Publish the release** on GitHub. Once public, running apps pick it up on
   their next launch.

> The app's tag button and `package.json`'s `version` are independent — keep them
> in sync (tag `v0.2.0` ↔ `"version": "0.2.0"`) so what CI builds matches what the
> updater compares against.

### Want "merge to main → release"?

Add [release-please](https://github.com/googleapis/release-please) as a second
workflow: it reads Conventional Commits (`feat:`, `fix:`) on `main` and keeps an
open "Release PR" that bumps the version and changelog. Merging that PR creates
the tag, which fires the workflow above. Ask and this can be wired up.

## Manual fallback (single OS)

If you'd rather build locally without CI:

```bash
npm version patch
npm run release   # electron-builder --publish always, for the current OS only
```

Run it on **macOS** for the `.dmg`/`.zip` and on **Windows** for the `.exe`, both
on the same tag so all assets land on one release, then publish it on GitHub.

## What users see

- On launch the app checks the feed. If a newer version exists, a banner appears:
  **"Version X is available"** → **Download**.
- Download progress shows in the banner; when finished it becomes
  **"Ready to install"** → **Restart & update**.

## Platform notes

| Platform | Auto-update | Notes |
| --- | --- | --- |
| Windows (NSIS) | ✅ Works | Unsigned builds update fine (SmartScreen warns on first install). |
| Linux (AppImage) | ✅ Works | Unsigned. |
| macOS | ⚠️ Needs signing | Detects and downloads, but **cannot install** until the app is code-signed **and notarized** (an Apple Developer account, ~$99/yr). Until then, macOS users update by downloading the new `.dmg` manually. |

To enable macOS auto-update later: add Apple signing credentials
(`CSC_LINK` / `CSC_KEY_PASSWORD`) and notarization config, then `npm run release`
from a Mac — no app code changes needed; the `zip` target is already in place.

## Testing the update flow locally

`electron-updater` is inert in dev (`npm run dev`) because there's no packaged
build to compare. To test end-to-end: publish a release at version *N*, install
it, then publish *N+1* and relaunch the installed app — the banner should appear.
