import { readFileSync } from "node:fs";

import ultraciteFmt from "ultracite/oxfmt";
import ultraciteLint from "ultracite/oxlint/core";
import { defineConfig } from "vite-plus";

// Stream Deck requires the plugin folder to be named `<UUID>.sdPlugin`, so the
// manifest is the single source of truth for the UUID.
const manifest = JSON.parse(readFileSync("src/manifest.json", "utf-8")) as {
  UUID: string;
};
const sdPlugin = `${manifest.UUID}.sdPlugin`;

export default defineConfig({
  fmt: {
    ...ultraciteFmt,
    ignorePatterns: [...ultraciteFmt.ignorePatterns, `${sdPlugin}/**`],
  },

  lint: {
    // The plugin itself runs as a Node process launched by the Stream Deck
    // host. src/ui is the only browser code, and it gets its own override.
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
        files: ["src/ui/**"],
      },
    ],
  },

  /**
   * `vp pack` builds the whole plugin folder, not just the bundle: the Stream
   * Deck host launches manifest.CodePath ("bin/plugin.js") as a Node process
   * and the packaged plugin ships no node_modules, so the SDK is inlined and
   * the output keeps a `.js` extension despite being CommonJS. The manifest,
   * Property Inspector pages and rendered icons are produced alongside it,
   * which is why the whole `<UUID>.sdPlugin` folder is gitignored.
   */
  pack: {
    clean: true,
    copy: [
      { from: "src/manifest.json", to: sdPlugin },
      { from: "src/ui/*", to: `${sdPlugin}/ui` },
    ],
    deps: { alwaysBundle: [/^@elgato\//u] },
    dts: false,
    entry: ["src/plugin.ts"],
    format: ["cjs"],
    hooks: {
      // Render icons-src/*.svg into the plugin's imgs/ folder before bundling,
      // so a single `vp pack` produces an installable plugin.
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
