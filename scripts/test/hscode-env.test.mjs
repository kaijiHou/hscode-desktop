import assert from "node:assert/strict";
import { test } from "node:test";
import { createHscodeEnvironment, recordHscodeBuild, verifyHscodeBuild } from "../hscode.mjs";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

test("HSCode entrypoint pins the brand, closes optional collectors and keeps caches with the checkout", () => {
  const env = createHscodeEnvironment(
    {
      HSCODE_BUILD: "0",
      ZCODE_ARMS_RUM_ENDPOINT: "https://collector.example.invalid",
      ZCODE_PACKAGED_AGENT_OTEL_HEADERS: "example-only",
      ZCODE_AUTO_UPDATE: "1",
      HSCODE_HOME: "D:/isolated-example",
    },
    "D:/source-example",
  );
  assert.equal(env.HSCODE_BUILD, "1");
  assert.equal(env.ZCODE_ENV, "production");
  assert.equal(env.ZCODE_AUTO_UPDATE, "0");
  for (const key of [
    "ZCODE_ARMS_RUM_ENDPOINT",
    "ZCODE_TELEMETRY_REPORT_ENDPOINT",
    "ZCODE_PACKAGED_AGENT_OTEL_ENDPOINT",
    "ZCODE_PACKAGED_AGENT_OTEL_HEADERS",
  ])
    assert.equal(env[key], "");
  assert.equal(env.HSCODE_HOME, "D:/isolated-example");
  assert.equal(env.ZCODE_TARGET_ARCH, process.arch);
  assert.equal(
    env.ZCODE_TARGET_OS,
    { win32: "win", darwin: "mac", linux: "linux" }[process.platform],
  );
  assert.match(env.TEMP, /\.agent-context[\\/]temp$/);
  assert.match(env.ELECTRON_BUILDER_CACHE, /\.agent-context[\\/]electron-builder-cache$/);
});

test("run refuses stale output even when an old HSCode build marker remains", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "hscode-build-stamp-"));
  await mkdir(resolve(root, "packages/desktop/out/metadata"), { recursive: true });
  await mkdir(resolve(root, "packages/desktop/out/main"), { recursive: true });
  const source = "export {};\n";
  const main = resolve(root, "packages/desktop/out/main/index.js");
  await writeFile(main, source);
  await writeFile(
    resolve(root, "packages/desktop/out/metadata/hscode-build.json"),
    JSON.stringify({
      hscodeBuild: true,
      mainSha256: createHash("sha256").update(source).digest("hex"),
    }),
  );
  await verifyHscodeBuild(root);
  await writeFile(main, `${source}// replaced by another build\n`);
  await assert.rejects(verifyHscodeBuild(root), /build identity does not match/);
  await assert.rejects(recordHscodeBuild(root, { HSCODE_BUILD: "0" }), /explicit HSCode build/);
  await recordHscodeBuild(root, { HSCODE_BUILD: "1" });
  await verifyHscodeBuild(root);
});
