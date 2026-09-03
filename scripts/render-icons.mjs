import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

import { Resvg } from "@resvg/resvg-js";

const root = path.join(import.meta.dirname, "..");

// The plugin folder name is `<manifest UUID>.sdPlugin`, so read it rather than
// repeating the UUID here.
const manifest = JSON.parse(
  readFileSync(path.join(root, "src", "assets", "manifest.json"), "utf-8")
);
const outRoot = path.join(root, `${manifest.UUID}.sdPlugin`, "imgs");

const jobs = [
  ["plugin/marketplace.svg", "plugin/marketplace", 256],
  ["plugin/category.svg", "plugin/category", 28],
  ...[
    "status",
    "needs",
    "agent",
    "prompt",
    "prev",
    "next",
    "worktree",
    "open",
  ].map((n) => [`actions/${n}.svg`, `actions/${n}`, 72]),
];

const render = (svg, width) => {
  const resvg = new Resvg(svg, {
    background: "rgba(0,0,0,0)",
    fitTo: { mode: "width", value: width },
  });
  return resvg.render().asPng();
};

for (const [src, base, width] of jobs) {
  const svg = readFileSync(
    path.join(root, "src", "assets", "icons", src),
    "utf-8"
  );
  for (const [suffix, scale] of [
    ["", 1],
    ["@2x", 2],
  ]) {
    const out = path.join(outRoot, `${base}${suffix}.png`);
    mkdirSync(path.dirname(out), { recursive: true });
    writeFileSync(out, render(svg, width * scale));
  }
  console.log(`rendered ${base}.png (@1x/@2x)`);
}
