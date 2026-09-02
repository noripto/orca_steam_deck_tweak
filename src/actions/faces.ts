import { context } from "../context.js";
import { fit, stateVisual } from "../render.js";
import type { KeyVisual } from "../render.js";

/** Builds the key face for a selector, given the arrow it should show. */
export type FaceFactory = (arrow: string) => KeyVisual;

export const agentFace: FaceFactory = (arrow) => {
  const agent = context.store.getSelectedAgent();
  if (!agent) {
    return { color: "#8a8f98", glyph: arrow, lines: ["AGENT", "NONE"] };
  }
  const visual = stateVisual(agent.state);
  return {
    color: visual.color,
    glyph: arrow,
    lines: [fit(agent.agentType ?? "agent"), fit(agent.label), visual.label],
  };
};

export const worktreeFace: FaceFactory = (arrow) => {
  const wt = context.store.getSelectedWorktree();
  if (!wt) {
    return { color: "#8a8f98", glyph: arrow, lines: ["WORKTREE", "NONE"] };
  }
  const visual = stateVisual(wt.state);
  return {
    color: visual.color,
    glyph: arrow,
    lines: [fit(wt.repo), fit(wt.branch), visual.label],
  };
};
