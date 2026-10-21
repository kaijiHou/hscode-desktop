// HSCode 隐私门禁与 OTLP 构建门禁的单测（执行提示词验收第 2/6 条的测试证据）。
import { describe, expect, it } from "vitest";
import { evaluateHscodePrivacyGuard } from "../hscode-privacy-guard.mjs";
import { resolveBuildPackagedAgentTelemetryEnv } from "../../packages/desktop/tsup.config.ts";

const cleanEnv = {
  ZCODE_ARMS_RUM_ENDPOINT: "",
  ZCODE_TELEMETRY_REPORT_ENDPOINT: "",
  ZCODE_PACKAGED_AGENT_OTEL_ENDPOINT: "",
  ZCODE_PACKAGED_AGENT_OTEL_HEADERS: "",
  ZCODE_AUTO_UPDATE: "0",
  HSCODE_BUILD: "1",
};

describe("evaluateHscodePrivacyGuard", () => {
  it("passes with all switches explicitly disabled", () => {
    expect(evaluateHscodePrivacyGuard(cleanEnv, false)).toEqual([]);
  });

  it("fails when any telemetry endpoint is set", () => {
    for (const name of [
      "ZCODE_ARMS_RUM_ENDPOINT",
      "ZCODE_TELEMETRY_REPORT_ENDPOINT",
      "ZCODE_PACKAGED_AGENT_OTEL_ENDPOINT",
      "ZCODE_PACKAGED_AGENT_OTEL_HEADERS",
    ]) {
      const env = { ...cleanEnv, [name]: "https://collector.example.com" };
      expect(evaluateHscodePrivacyGuard(env, false)).toContainEqual(
        expect.stringContaining(name),
      );
    }
  });

  it("fails when auto update is enabled", () => {
    expect(evaluateHscodePrivacyGuard({ ...cleanEnv, ZCODE_AUTO_UPDATE: "1" }, false)).toEqual(
      [expect.stringContaining("ZCODE_AUTO_UPDATE")],
    );
  });

  it("fails when private build defaults file exists", () => {
    expect(evaluateHscodePrivacyGuard(cleanEnv, true)).toEqual([
      expect.stringContaining("config/private/build-defaults.json"),
    ]);
  });

  it("requires the HSCode build flag", () => {
    expect(evaluateHscodePrivacyGuard({ ...cleanEnv, HSCODE_BUILD: "" }, false)).toEqual(
      [expect.stringContaining("HSCODE_BUILD")],
    );
  });
});

describe("resolveBuildPackagedAgentTelemetryEnv HSCode gate", () => {
  it("returns no OTLP env for HSCode builds even when endpoints are configured", () => {
    const env = resolveBuildPackagedAgentTelemetryEnv({
      HSCODE_BUILD: "1",
      ZCODE_PACKAGED_AGENT_OTEL_ENDPOINT: "https://otel.example.com/v1/traces",
      ZCODE_PACKAGED_AGENT_OTEL_HEADERS: "Authorization=Bearer test",
      CI: "1",
      CI_COMMIT_TAG: "v3.16.2",
    });
    expect(env).toEqual({});
  });

  it("keeps upstream release gate intact without HSCODE_BUILD", () => {
    expect(() =>
      resolveBuildPackagedAgentTelemetryEnv({
        CI: "1",
        CI_COMMIT_TAG: "v3.16.2",
      }),
    ).toThrow(/Packaged Agent OTLP configuration is required/);
  });

  it("returns empty env for normal non-CI builds without config", () => {
    expect(resolveBuildPackagedAgentTelemetryEnv({})).toEqual({});
  });
});
