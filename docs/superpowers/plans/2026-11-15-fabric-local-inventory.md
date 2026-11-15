# Fabric Local Inventory Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for this local slice.

**Goal:** Provide an explicit, read-only local Fabric inventory without implying
that network enrollment, remote work or permission grants exist.

**Architecture:** A Node-specific adapter observes only OS platform,
architecture, available logical processors and total memory. An explicit CLI
command prints the versioned result without booting the Aeon runtime. An
authenticated loopback-only endpoint and the existing device page expose the
same report on request. Future distributed work uses the design's independent
authorization and transport.

**Tech stack:** Existing TypeScript, Node built-ins and Node test runner; no new
packages, downloads or network listeners.

**Spec:** [Aeon Fabric architecture](../specs/2026-11-15-aeon-fabric-design.md).

## Global constraints

- Runtime-neutral core remains free of Node APIs; inventory belongs in src/node.
- No environment contents, host/user names, IP addresses, secrets, paths or CPU
  model appear in the inventory. No settings, key store or database is opened.
- Discovery is informational and conveys no execution grant. Unsupported
  hardware and unknown capacities are not represented as available.
- Use the existing CLI and JSON conventions; keep unsupported distributed
  actions unavailable.

## Review focus

- Invalid or extra subcommands must return a nonzero status without booting the
  runtime or creating configuration.
- Missing/invalid capacity readings become unknown, not a fabricated zero.
- An inventory never creates execution capabilities or permissions.
- On an otherwise empty working/config directory, a real process creates no
  persistent files or network listeners.
- The existing API must refuse unauthenticated or non-loopback inventory reads;
  other paired UI devices do not get remote access to these readings.
- Existing commands and the Node 18 mobile compile must continue working.

## Task 1: Local inventory and CLI

**Files:** Create src/node/fabric-inventory.ts and test/fabric-inventory.test.ts;
modify src/node/cli.ts and docs/TESTING.md.

**Interfaces:** Export localFabricInventory() for actual observations and
fabricInventoryFrom(source) for mapping OS data safely; the CLI command
fabric inspect returns one JSON object.

- [x] Write tests for real-process invocation, privacy, no files, invalid
      subcommands, no grants and the conversion of invalid measurements to null.
- [x] Run the targeted test and confirm it fails because the feature is absent.
- [x] Implement the observation and command without booting the runtime.
- [x] Run the targeted test, full npm tests, typecheck and mobile build.
- [x] Record what was actually run and what remains untested in TESTING.md.

## Task 2: Loopback API and device-page access

**Files:** Modify src/node/server/server.ts, test/models-and-devices.test.ts,
ui/composeApp/src/commonMain/kotlin/dev/aeon/ui/api/AeonClient.kt,
api/Models.kt, state/AppModel.kt and screens/Devices.kt.

**Interfaces:** GET /v1/fabric/local returns LocalFabricInventory only after
device authentication and a loopback request. The device page requests it only
on explicit user action when the agent runs on the current device.

- [x] Write server tests for unauthenticated, authenticated local and
      authenticated non-local requests; run them and see the new route fail.
- [x] Add the local-only route using the existing signature verifier.
- [x] Add the client model and an on-request device-page panel with loading,
      failure and unknown-capacity states; keep remote execution unavailable.
- [x] Run targeted server tests, complete core and Kotlin checks and the mobile
      build; run the desktop app and verify the device-page action at high DPI.
