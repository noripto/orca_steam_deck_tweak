import { readFileSync, writeFileSync } from "node:fs";

import ultraciteFmt from "ultracite/oxfmt";
import ultraciteLint from "ultracite/oxlint/core";
import { defineConfig } from "vite-plus";

const manifest = JSON.parse(
  readFileSync("src/assets/manifest.json", "utf-8")
) as {
  UUID: string;
};
const sdPlugin = `${manifest.UUID}.sdPlugin`;

export default defineConfig({
  fmt: {
    ...ultraciteFmt,
    ignorePatterns: [...ultraciteFmt.ignorePatterns, `${sdPlugin}/**`],
  },

  lint: {
    env: { browser: false, builtin: true, es2022: true, node: true },
    extends: [ultraciteLint],
    ignorePatterns: [
      ...ultraciteLint.ignorePatterns,
      `${sdPlugin}/**`,
      "**/*.d.ts",
    ],
    overrides: [
      {
        env: { browser: true, node: false },
        files: ["src/assets/ui/**"],
      },
    ],
  },

  pack: {
    clean: true,
    copy: [
      { from: "src/assets/manifest.json", to: sdPlugin },
      { from: "src/assets/ui/*", to: `${sdPlugin}/ui` },
    ],
    deps: { alwaysBundle: [/^@elgato\//u] },
    dts: false,
    entry: ["src/plugin.ts"],
    format: ["cjs"],
    hooks: {
      "build:done": () => {
        writeFileSync(
          `${sdPlugin}/bin/package.json`,
          `${JSON.stringify({ type: "commonjs" }, null, 2)}\n`
        );
      },
      "build:prepare": async () => {
        await import("./scripts/render-icons.mjs");
      },
    },
    outDir: `${sdPlugin}/bin`,
    outExtensions: () => ({ js: ".js" }),
    platform: "node",
    sourcemap: true,
    target: "node20",
  },

  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
