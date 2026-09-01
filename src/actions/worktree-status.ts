import {
  action,
  type KeyDownEvent,
  type WillAppearEvent,
  type DialRotateEvent,
  type DialDownEvent
} from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";

import { context } from "../context.js";
import { openOrca, resolveTerminalHandle, terminalSwitch } from "../orca/api.js";
import { cliOptions } from "../state/store.js";
import type { OrcaSnapshot } from "../orca/types.js";
import { fit, renderConnectionKey, renderKey, stateVisual } from "../render.js";
import { OrcaAction } from "./base.js";

@action({ UUID: "dev.onorca.streamdeck.worktree-status" })
export class WorktreeStatusAction extends OrcaAction {
  protected render(action: WillAppearEvent<JsonObject>["action"], snapshot: OrcaSnapshot): void {
    const wt = context.store.getSelectedWorktree();

    if (action.isDial()) {
      if (snapshot.connection !== "online") {
        void action.setFeedback({ title: "ORCA", value: snapshot.connection.toUpperCase() });
        return;
      }
      void action.setFeedback({
        title: wt ? `${fit(wt.repo, 12)}` : "WORKTREE",
        value: wt ? `${fit(wt.branch, 14)} · ${stateVisual(wt.state).label}` : "none"
      });
      return;
    }

    void action.setTitle("");
    if (snapshot.connection !== "online") {
      void action.setImage(renderConnectionKey(snapshot.connection, "WT"));
      return;
    }
    if (!wt) {
      void action.setImage(renderKey({ glyph: "❏", color: "#8a8f98", lines: ["WORKTREE", "NONE"] }));
      return;
    }
    const visual = stateVisual(wt.state);
    void action.setImage(
      renderKey({
        glyph: "❏",
        color: visual.color,
        lines: [fit(wt.repo), fit(wt.branch), `${wt.agentCount} agent${wt.agentCount === 1 ? "" : "s"}`]
      })
    );
  }

  override onDialRotate(ev: DialRotateEvent<JsonObject>): void {
    context.store.stepWorktree(ev.payload.ticks >= 0 ? 1 : -1);
    this.renderAll(context.store.getSnapshot());
  }

  override async onDialDown(ev: DialDownEvent<JsonObject>): Promise<void> {
    await this.openSelected();
    this.renderAll(context.store.getSnapshot());
  }

  override async onKeyDown(_ev: KeyDownEvent<JsonObject>): Promise<void> {
    await this.openSelected();
  }

  private async openSelected(): Promise<void> {
    const wt = context.store.getSelectedWorktree();
    if (!wt) return;
    const opts = cliOptions(context.store.getSettings());
    try {
      await openOrca(opts);
      const agent = context.store.getSnapshot().agents.find((a) => a.worktreeId === wt.worktreeId);
      const handle = await resolveTerminalHandle(wt.path, agent?.terminalTitleHint ?? null, opts);
      if (handle) await terminalSwitch(handle, opts);
    } catch {
      throw new Error("next poll reflects reality")
    }
    await context.poller.refreshNow();
  }
}
