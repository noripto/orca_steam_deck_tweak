import type { OrcaAgentState, OrcaConnection } from "./orca/types.js";

export interface KeyVisual {
  glyph: string;
  color: string;
  lines: string[];
}

const STATE_VISUALS: Record<OrcaAgentState, { glyph: string; color: string; label: string }> = {
  working: { glyph: "●", color: "#33c26a", label: "WORKING" },
  waiting: { glyph: "!", color: "#f5a623", label: "NEEDS YOU" },
  done: { glyph: "✓", color: "#4a90e2", label: "DONE" },
  idle: { glyph: "○", color: "#8a8f98", label: "IDLE" },
  unknown: { glyph: "?", color: "#8a8f98", label: "UNKNOWN" }
};

export function stateVisual(state: OrcaAgentState): { glyph: string; color: string; label: string } {
  return STATE_VISUALS[state];
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function fit(text: string, max = 9): string {
  const t = (text ?? "").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(1, max - 1))}…`;
}

export function renderKey(visual: KeyVisual): string {
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
}

export function renderConnectionKey(connection: OrcaConnection, headline = "ORCA"): string {
  switch (connection) {
    case "cli-missing":
      return renderKey({ glyph: "⌗", color: "#f5a623", lines: [headline, "CLI", "MISSING"] });
    case "offline":
      return renderKey({ glyph: "⏻", color: "#8a8f98", lines: [headline, "OFFLINE"] });
    case "error":
      return renderKey({ glyph: "!", color: "#e0555b", lines: [headline, "ERROR"] });
    default:
      return renderKey({ glyph: "●", color: "#33c26a", lines: [headline, "ONLINE"] });
  }
}
