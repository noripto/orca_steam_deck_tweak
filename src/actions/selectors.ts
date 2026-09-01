import { action, type KeyDownEvent, type WillAppearEvent } from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";

import { context } from "../context.js";
import type { OrcaSnapshot } from "../orca/types.js";
import { fit, renderConnectionKey, renderKey, stateVisual } from "../render.js";
import { OrcaAction } from "./base.js";

function agentFace(snapshot: OrcaSnapshot, arrow: string): { glyph: string; color: string; lines: string[] } {
  const agent = context.store.getSelectedAgent();
  if (!agent) return { glyph: arrow, color: "#8a8f98", lines: ["AGENT", "NONE"] };
  const visual = stateVisual(agent.state);
  return {
    glyph: arrow,
    color: visual.color,
    lines: [fit(agent.agentType ?? "agent"), fit(agent.label), visual.label]
  };
}

function worktreeFace(snapshot: OrcaSnapshot, arrow: string): { glyph: string; color: string; lines: string[] } {
  const wt = context.store.getSelectedWorktree();
  if (!wt) return { glyph: arrow, color: "#8a8f98", lines: ["WORKTREE", "NONE"] };
  const visual = stateVisual(wt.state);
  return { glyph: arrow, color: visual.color, lines: [fit(wt.repo), fit(wt.branch), visual.label] };
}

abstract class StepAction extends OrcaAction {
  protected abstract arrow: string;
  protected abstract step(): void;
  protected abstract face(snapshot: OrcaSnapshot): { glyph: string; color: string; lines: string[] };

  protected render(action: WillAppearEvent<JsonObject>["action"], snapshot: OrcaSnapshot): void {
    void action.setTitle("");
    if (snapshot.connection !== "online") {
      void action.setImage(renderConnectionKey(snapshot.connection, "SELECT"));
      return;
    }
    void action.setImage(renderKey(this.face(snapshot)));
  }

  override async onKeyDown(ev: KeyDownEvent<JsonObject>): Promise<void> {
    this.step();
    this.renderAll(context.store.getSnapshot());
    await ev.action.showOk();
  }
}

@action({ UUID: "dev.onorca.streamdeck.prev-agent" })
export class PrevAgentAction extends StepAction {
  protected arrow = "◀";
  protected step(): void {
    context.store.stepAgent(-1);
  }
  protected face(s: OrcaSnapshot) {
    return agentFace(s, this.arrow);
  }
}

@action({ UUID: "dev.onorca.streamdeck.next-agent" })
export class NextAgentAction extends StepAction {
  protected arrow = "▶";
  protected step(): void {
    context.store.stepAgent(1);
  }
  protected face(s: OrcaSnapshot) {
    return agentFace(s, this.arrow);
  }
}

@action({ UUID: "dev.onorca.streamdeck.prev-worktree" })
export class PrevWorktreeAction extends StepAction {
  protected arrow = "◀";
  protected step(): void {
    context.store.stepWorktree(-1);
  }
  protected face(s: OrcaSnapshot) {
    return worktreeFace(s, this.arrow);
  }
}

@action({ UUID: "dev.onorca.streamdeck.next-worktree" })
export class NextWorktreeAction extends StepAction {
  protected arrow = "▶";
  protected step(): void {
    context.store.stepWorktree(1);
  }
  protected face(s: OrcaSnapshot) {
    return worktreeFace(s, this.arrow);
  }
}
