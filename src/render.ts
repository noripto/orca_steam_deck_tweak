import type { OrcaAgentState, OrcaConnection } from "./orca/types.js";

export interface KeyVisual {
  glyph: string;
  color: string;
  lines: string[];
}

const STATE_VISUALS: Record<
  OrcaAgentState,
  { glyph: string; color: string; label: string }
> = {
  done: { color: "#4a90e2", glyph: "✓", label: "DONE" },
  idle: { color: "#8a8f98", glyph: "○", label: "IDLE" },
  unknown: { color: "#8a8f98", glyph: "?", label: "UNKNOWN" },
  waiting: { color: "#f5a623", glyph: "!", label: "NEEDS YOU" },
  working: { color: "#33c26a", glyph: "●", label: "WORKING" },
};

export const stateVisual = (
  state: OrcaAgentState
): {
  glyph: string;
  color: string;
  label: string;
} => STATE_VISUALS[state];

const escapeXml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export const fit = (text: string, max = 9): string => {
  const t = (text ?? "").trim();
  if (t.length <= max) {
    return t;
  }
  return `${t.slice(0, Math.max(1, max - 1))}…`;
};

export const renderKey = (visual: KeyVisual): string => {
  const lines = visual.lines.slice(0, 3);
  const startY = lines.length >= 3 ? 78 : 88;
  const lineSpacing = 24;

  const textEls = lines
    .map((line, i) => {
      const y = startY + i * lineSpacing;
      const weight = i === 0 ? "700" : "500";
      const size = i === 0 ? 19 : 16;
      const fill = i === 0 ? "#ffffff" : "#c7ccd4";
      return `<text x="72" y="${y}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${escapeXml(
        fit(line, i === 0 ? 10 : 12)
      )}</text>`;
    })
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">
<rect width="144" height="144" rx="14" fill="#1b1d21"/>
<text x="72" y="46" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="40" font-weight="700" fill="${visual.color}">${escapeXml(
    visual.glyph
  )}</text>
${textEls}
</svg>`;

  return `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`;
};

export const renderConnectionKey = (
  connection: OrcaConnection,
  headline = "ORCA"
): string => {
  switch (connection) {
    case "cli-missing": {
      return renderKey({
        color: "#f5a623",
        glyph: "⌗",
        lines: [headline, "CLI", "MISSING"],
      });
    }
    case "offline": {
      return renderKey({
        color: "#8a8f98",
        glyph: "⏻",
        lines: [headline, "OFFLINE"],
      });
    }
    case "error": {
      return renderKey({
        color: "#e0555b",
        glyph: "!",
        lines: [headline, "ERROR"],
      });
    }
    default: {
      return renderKey({
        color: "#33c26a",
        glyph: "●",
        lines: [headline, "ONLINE"],
      });
    }
  }
};
