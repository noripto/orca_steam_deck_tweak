import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";

const sdPlugin = "dev.onorca.streamdeck.sdPlugin";

/**
 * The Stream Deck host launches the plugin as a Node.js process whose entry point
 * is manifest.CodePath ("bin/plugin.js"). We bundle everything into that single
 * CommonJS file so the installed plugin has no external dependency to resolve.
 */
export default {
  input: "src/plugin.ts",
  output: {
    file: `${sdPlugin}/bin/plugin.js`,
    format: "cjs",
    sourcemap: true,
    sourcemapPathTransform: (relativeSourcePath, sourcemapPath) => {
      return relativeSourcePath;
    }
  },
  plugins: [
    typescript({ tsconfig: "./tsconfig.json" }),
    nodeResolve({ browser: false, exportConditions: ["node"], preferBuiltins: true }),
    commonjs()
  ],
  external: []
};
