# Releasing

A release is a **draft** GitHub release made from a tag. Nothing is published until a maintainer reads the draft and presses *Publish*. The workflow is `.github/workflows/release.yml` (decision D30).

## What a release contains

| File | Built on | Signed |
|---|---|---|
| `aeon-<version>-android.apk` | Linux runner | with the release key, **once the secrets below exist** |
| `aeon-<version>-android-debug-key.apk` | Linux runner | with the debug key: installs for testing, cannot be updated by a later release-key build. Left out of the release when the signed one exists |
| `Aeon-<1.2.3>.msi`, `Aeon-<1.2.3>.exe` (they carry the agent and a Node.js runtime, whose `node.exe` alone is 93 MB before compression, so nobody has to install Node.js; decision D36). In the dry run on GitHub's runners (2026-11-15) the Windows artifact holding the MSI and the EXE together was 211 MB, the `.deb` 65 MB (unchanged: it does not carry the agent); an MSI built on one computer was 107 MB; the EXE was not measured one by one | Windows runner | not signed (Windows SmartScreen will warn) |
| `aeon_<1.2.3>_amd64.deb` (about 65 MB) | Linux runner | not signed |
| `aeon-<version>-web.zip` | Linux runner | the web app; start the server with `--web <folder>` |
| `SHA256SUMS.txt` | | checksums of all of the above |

Not built: macOS and iOS (out of scope), Windows ARM64 and rpm packages (a `jpackage` build runs only on the machine it is on), an automatic updater, Google Play.

## Making a release

1. `main` is green and contains what should ship.
2. A repository administrator creates the tag (only administrators can: see *Protections*):
   ```bash
   git tag v1.2.3
   git push origin v1.2.3
   ```
   `v1.2.3-rc1` is also accepted and makes a pre-release. A version below 1.0.0 is always a pre-release. Anything else (`v1`, `v1.2`, `release-1`) stops at the first step.
3. The workflow runs the CI checks, then builds the Android app, the desktop installers and the web app. The signed Android build **waits for a maintainer's approval** (either of the two; GitHub shows *Review deployments* on the run).
4. When everything is built, the draft release appears under *Releases* with generated notes. Read it, edit the notes, press *Publish*.

The version comes from the tag: `1.2.3` becomes the Android `versionName`, `10203` its `versionCode` (major × 10000 + minor × 100 + patch, so it only grows), and the numeric part is the Windows and Linux package version.

## The agent inside the Windows installer

`-PbundleAgent` (the Windows entry of the desktop job passes it) makes Gradle run `tools/package-agent.mjs`, which compiles the agent and downloads the Node.js runtime pinned in `tools/agent-runtime.json`. The download is checked against the SHA-256 in that file and thrown away if it differs. To move to another Node.js version, change the version, the address and the hash together, taking the hash from `https://nodejs.org/dist/v<version>/SHASUMS256.txt`. A normal build or test run does not need npm or the download; to try the bundled app on a computer: `cd ui && ./gradlew :composeApp:createDistributable -PbundleAgent -PagentNode="C:/Program Files/nodejs/node.exe"` (`-PagentNode` uses a Node.js that is already installed instead of downloading) and start `composeApp/build/compose/binaries/main/app/Aeon/Aeon.exe`. (Gradle does not notice that the agent folder is new: if the app folder was built before without it, delete `ui/composeApp/build/compose/binaries` first. A build on a clean checkout, like the workflow's, has no such problem.)

## The signing key and the secrets

The Android release key is the app's identity: **a phone installs an update only if it is signed with the same key as the installed version.** Make it yourself, on your own computer, and keep two copies of the file and its passwords somewhere safe (a password manager and an offline copy). If it is lost, every installed copy has to be uninstalled and installed again; GitHub secrets cannot be read back, so they are not a backup.

```bash
keytool -genkeypair -v -keystore aeon-release.jks -alias aeon -keyalg RSA -keysize 4096 -validity 10000
base64 -w0 aeon-release.jks > aeon-release.jks.b64        # on Windows (Git Bash) the same command works

gh secret set ANDROID_KEYSTORE_BASE64   --env release --repo AeonAgents/Aeon-Agent < aeon-release.jks.b64
gh secret set ANDROID_KEYSTORE_PASSWORD --env release --repo AeonAgents/Aeon-Agent
gh secret set ANDROID_KEY_ALIAS         --env release --repo AeonAgents/Aeon-Agent
gh secret set ANDROID_KEY_PASSWORD      --env release --repo AeonAgents/Aeon-Agent
rm aeon-release.jks.b64
```

`gh secret set` asks for the three short values on the keyboard; they never go into a file or the shell history. The secrets belong to the **`release` environment**, not to the repository, so a workflow run that does not go through the environment (a pull request, a branch) cannot read them.

Until the secrets exist the workflow still works: the signed job says so and the release gets the debug-key APK only.

## Protections

- **Environment `release`**: needs the approval of either maintainer for every run that uses it, and runs only for tags matching `v*`.
- **Tag ruleset `Release tags`**: `v*` tags can be created, moved and deleted by repository administrators only (the administrator role is the ruleset's bypass; the organisation's two owners hold it). A collaborator with write access cannot start a release.
- The workflow's own token is read-only except in the last job, which only creates the *draft*.
- Pull requests that change `release.yml` build everything once (a dry run, no release, no secrets) so the workflow is tested before it is used. A pull request from a fork does not get secrets at all.

## What has and has not been tried

**What has been run (2026-11-14, with a throwaway key made for the test and deleted afterwards):** the whole pipeline on GitHub, twice, with test tags `v0.0.1-test` and `v0.0.2-test`: the CI checks, the debug-key APK, the Windows msi and exe, the Linux deb, the web zip, the wait for the owner's approval on the `release` environment (approved by the owner's instruction), the signed Android job (the APK was downloaded and read back: signed by the throwaway key, `versionName` 0.0.1-test, `versionCode` 1), and the draft release (a pre-release draft with five files and `SHA256SUMS.txt`; the checksum of a downloaded file matched). The first run failed in the last job (`sha256sum: exe: Is a directory`: the installers arrive in folders), which is how the folder bug was found and fixed. The draft, both tags and the four secrets were deleted after the test. **Not run:** a release with the owner's real key, and publishing a draft. See decision D30 in [DECISIONS.md](DECISIONS.md).
