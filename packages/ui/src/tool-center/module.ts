/** HSCode tool-center module manifest; keep its public dependency aligned with architecture-policy.yaml. */
export const hscodeToolCenterModule = {
  id: "hscode-tool-center",
  requires: ["ui"],
  provides: ["hscode-tool-center"],
  publicEntrypoints: ["index.ts", "contract.ts"],
} as const;
