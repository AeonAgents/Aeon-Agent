import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { availableParallelism, totalmem } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fabricInventoryFrom } from "../src/node/fabric-inventory.ts";
import { tempDir } from "./helpers.ts";

const cli = join(import.meta.dirname, "..", "src", "node", "cli.ts");

describe("Fabric local inventory CLI", () => {
  it("reports this machine without opening a runtime, creating files, or granting operations", () => {
    const { dir, cleanup } = tempDir();
    try {
      const config = join(dir, "config-not-created");
      const result = spawnSync(process.execPath, [cli, "fabric", "inspect"], {
        cwd: dir,
        encoding: "utf8",
        env: {
          SystemRoot: process.env.SystemRoot,
          AEON_CONFIG_DIR: config,
          EXAONE_API_KEY: "fabric-inventory-secret-sentinel",
        },
      });
      assert.equal(result.status, 0, result.stderr);
      const report = JSON.parse(result.stdout);
      assert.equal(report.schemaVersion, 1);
      assert.equal(report.kind, "local-inventory");
      assert.equal(report.platform, process.platform);
      assert.equal(report.architecture, process.arch);
      assert.equal(report.logicalCpus, availableParallelism());
      assert.equal(report.memoryBytes, totalmem());
      assert.deepEqual(report.grants, []);
      assert.equal(report.remoteExecution, false);
      assert.deepEqual(Object.keys(report).sort(), [
        "architecture", "grants", "kind", "logicalCpus", "memoryBytes", "platform", "remoteExecution", "schemaVersion",
      ]);
      assert.ok(!result.stdout.includes("fabric-inventory-secret-sentinel"));
      assert.deepEqual(readdirSync(dir), []);
      assert.equal(existsSync(config), false);
    } finally {
      cleanup();
    }
  });

  it("marks invalid capacity observations unknown", () => {
    for (const capacity of [null, 0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      const report = fabricInventoryFrom({
        platform: "example",
        architecture: "example",
        logicalCpus: capacity,
        memoryBytes: capacity,
      });
      assert.equal(report.logicalCpus, null);
      assert.equal(report.memoryBytes, null);
      assert.deepEqual(report.grants, []);
    }
  });

  it("rejects unknown or extra Fabric arguments without creating settings", () => {
    const { dir, cleanup } = tempDir();
    try {
      for (const args of [["fabric"], ["fabric", "run"], ["fabric", "inspect", "extra"]]) {
        const result = spawnSync(process.execPath, [cli, ...args], {
          cwd: dir,
          encoding: "utf8",
          env: { SystemRoot: process.env.SystemRoot, AEON_CONFIG_DIR: join(dir, "config-not-created") },
        });
        assert.equal(result.status, 1);
        assert.match(result.stderr, /fabric inspect/);
        assert.deepEqual(readdirSync(dir), []);
      }
    } finally {
      cleanup();
    }
  });
});
