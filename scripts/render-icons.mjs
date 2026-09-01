import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outRoot = join(root, "dev.onorca.streamdeck.sdPlugin", "imgs");

const jobs = [
  ["plugin/marketplace.svg", "plugin/marketplace", 256],
  ["plugin/category.svg", "plugin/category", 28],
  ...["status", "needs", "agent", "prompt", "prev", "next", "worktree", "open"].map((n) => [
    `actions/${n}.svg`,
    `actions/${n}`,
    72
  ])
];

function render(svg, width) {
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: width }, background: "rgba(0,0,0,0)" });
  return resvg.render().asPng();
}

for (const [src, base, width] of jobs) {
  const svg = readFileSync(join(root, "icons-src", src), "utf-8");
  for (const [suffix, scale] of [["", 1], ["@2x", 2]]) {
    const out = join(outRoot, `${base}${suffix}.png`);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, render(svg, width * scale));
  }
  console.log(`rendered ${base}.png (@1x/@2x)`);
}
