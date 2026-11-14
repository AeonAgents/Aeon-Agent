# How branches are used

Decision D28. The aim: `main` always works, every change reaches it through a short-lived branch and a pull request, and no stale branches pile up.

## The rules

1. **`main` always passes.** `npm run typecheck` and `npm test` are green on it; if the UI changed, so is `./gradlew :composeApp:desktopTest`. Nothing is committed to `main` directly.
2. **One topic per branch**, named `type/short-topic` in lowercase with hyphens: `feat/`, `fix/`, `docs/`, `chore/`, `test/` (for example `feat/feed-reactions`, `fix/pairing-timeout`). Aim for days, not weeks, and a diff a person can read (a few hundred lines). Split a big change into steps that each leave `main` working.
3. **Start from a fresh `main`:**
   ```bash
   git switch main && git pull --ff-only
   git switch -c feat/short-topic
   ```
4. **Before opening the PR:** run the checks above, update what the change touches (`docs/DECISIONS.md` for a decision, `docs/TESTING.md` for what was and was not verified, `docs/API.md` and `docs/THREAT_MODEL.md` for routes and risks). The PR text says what was *not* verified.
5. **Keep up with `main`** while the branch lives: `git fetch && git merge origin/main` (a merge, not a rebase, once the branch is pushed and others may have read it). Push your own branch with `--force-with-lease` only if you rewrote it; never force-push `main`.
6. **How a PR is merged:**
   - **Squash** by default: one commit on `main` with the PR title and a short body. It keeps `main` readable and a revert is one commit.
   - **Merge commit** only when the commits themselves carry history worth keeping (the first big PR, #1, was merged this way because its 50 commits record decisions D17 to D27).
   - **No rebase-merge**: it rewrites SHAs that notes and reviews point at.
7. **Delete the branch when it is merged** (on GitHub and locally) and prune: `git switch main && git pull --ff-only && git branch -d <branch> && git fetch --prune`. See what is left with `git branch --merged main` and `git branch -r`.
8. **Commit messages** say what and why in the imperative, with the attribution trailer the tool adds. The first line is the part that shows in the log.

## Fixes and releases

- A fix follows the same path (`fix/…`), only smaller. There are no long-lived `develop` or release branches; a release is a tag on `main` (`v0.x.y`), made when a version is worth naming.
- Work that must not be lost but is not ready lives on its own pushed branch with a draft PR, so it is visible and can be picked up.

## What the repository enforces (decision D29)

- **CI** (`.github/workflows/ci.yml`) runs on every pull request and on `main`: typecheck and tests of the core on Linux and Windows, and the Kotlin desktop tests plus the web compile. All three must pass to merge.
- **`main` is protected:** changes arrive by pull request only, with the three checks passing, resolved conversations and a branch that is up to date; no force-push, no deletion. A change that touches no file with a code owner needs **no approval**: when the checks are green its author merges it. The two maintainers are administrators of the organisation and can override the rule; they say so in the pull request when they do (decision D34).
- **Merging:** squash and merge commit are allowed, rebase-merge is off. Merged branches are deleted automatically.
- **Code owners** (`.github/CODEOWNERS`, the team `@AeonAgents/maintainers`) must approve a change to the files they own, with one approval from a maintainer who did not push last. Those files are the policy engine, the sandbox and file/network guards, the server, skills, memory, the workflows, the build scripts and Gradle wrapper, the npm packages, the decision log, the threat model and the licence. For every other file there is no approval step.
- **Pull requests from forks** need the maintainer's approval before their workflows run, and workflows get a read-only token.
- **Releases** (decision D30, [RELEASING.md](RELEASING.md)): `v*` tags can be created by administrators only; the release workflow's signing key sits in an environment that needs a maintainer's approval (either of the two).
- **Actions** may use GitHub's own actions and `gradle/actions/*` only (anything else is refused until a maintainer allows it), and each one is pinned to a full commit hash (decision D35; Dependabot proposes the update); **CodeQL** scans the Kotlin, TypeScript and workflow code.
- **Security:** private vulnerability reporting, secret scanning with push protection, Dependabot alerts and updates are on.

What is *not* enforced: that every pull request has a test or a doc update (the template asks, a reviewer checks), and anything about contributors' machines.
