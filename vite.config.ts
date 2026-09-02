import ultraciteFmt from "ultracite/oxfmt";
import ultraciteLint from "ultracite/oxlint/core";
import { defineConfig } from "vite-plus";

const sdPlugin = "dev.onorca.streamdeck.sdPlugin";

export default defineConfig({
  fmt: {
    ...ultraciteFmt,
    // bin/ is the bundle; manifest.json and ui/ are source and stay formatted.
    ignorePatterns: [...ultraciteFmt.ignorePatterns, `${sdPlugin}/bin/**`],
  },

  lint: {
    // The plugin runs as a Node process launched by the Stream Deck host, so
    // the browser globals the Ultracite core preset enables do not apply. The
    // Property Inspector pages are the only browser code, and they live under
    // the sdPlugin folder excluded below.
    env: { browser: false, builtin: true, es2022: true, node: true },
    extends: [ultraciteLint],
    ignorePatterns: [
      ...ultraciteLint.ignorePatterns,
      `${sdPlugin}/**`,
      "**/*.d.ts",
    ],
  },

  /**
   * Replaces the rollup config from the Elgato template. The Stream Deck host
   * launches manifest.CodePath ("bin/plugin.js") as a Node process, and the
   * packaged plugin ships no node_modules, so the SDK has to be inlined and
   * the output has to keep the `.js` extension despite being CommonJS.
   */
  pack: {
    clean: true,
    deps: { alwaysBundle: [/^@elgato\//u] },
    dts: false,
    entry: ["src/plugin.ts"],
    format: ["cjs"],
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
