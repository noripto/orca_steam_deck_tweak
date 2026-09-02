import { action } from "@elgato/streamdeck";
import type {
  KeyDownEvent,
  WillAppearEvent,
  DialRotateEvent,
  DialDownEvent,
} from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";

import { context } from "../context.js";
import { logger } from "../logger.js";
import {
  openOrca,
  resolveTerminalHandle,
  terminalSwitch,
} from "../orca/api.js";
import type { OrcaSnapshot } from "../orca/types.js";
import { fit, renderConnectionKey, renderKey, stateVisual } from "../render.js";
import { cliOptions } from "../state/store.js";
import { OrcaAction } from "./base.js";

/**
 * Brings Orca forward on the selected worktree. Failures are reported on the
 * key and logged rather than thrown: the caller is a Stream Deck event handler,
 * and the next poll re-reads the real state anyway.
 */
const openSelectedWorktree = async (
  key: KeyDownEvent<JsonObject>["action"] | DialDownEvent<JsonObject>["action"]
): Promise<void> => {
  const wt = context.store.getSelectedWorktree();
  if (!wt) {
    return;
  }
  const opts = cliOptions(context.store.getSettings());
  try {
    await openOrca(opts);
    const agent = context.store
      .getSnapshot()
      .agents.find((a) => a.worktreeId === wt.worktreeId);
    const handle = await resolveTerminalHandle(
      wt.path,
      agent?.terminalTitleHint ?? null,
      opts
    );
    if (handle) {
      await terminalSwitch(handle, opts);
    }
  } catch (error) {
    logger.error(`failed to open worktree ${wt.path}`, error);
    await key.showAlert();
  }
  await context.poller.refreshNow();
};

@action({ UUID: "dev.orca-ade.streamdeck.worktree-status" })
export class WorktreeStatusAction extends OrcaAction {
  // oxlint-disable-next-line eslint/class-methods-use-this
  protected render(
    key: WillAppearEvent<JsonObject>["action"],
    snapshot: OrcaSnapshot
  ): void {
    const wt = context.store.getSelectedWorktree();

    if (key.isDial()) {
      if (snapshot.connection !== "online") {
        void key.setFeedback({
          title: "ORCA",
          value: snapshot.connection.toUpperCase(),
        });
        return;
      }
      void key.setFeedback({
        title: wt ? `${fit(wt.repo, 12)}` : "WORKTREE",
        value: wt
          ? `${fit(wt.branch, 14)} · ${stateVisual(wt.state).label}`
          : "none",
      });
      return;
    }

    void key.setTitle("");
    if (snapshot.connection !== "online") {
      void key.setImage(renderConnectionKey(snapshot.connection, "WT"));
      return;
    }
    if (!wt) {
      void key.setImage(
        renderKey({ color: "#8a8f98", glyph: "❏", lines: ["WORKTREE", "NONE"] })
      );
      return;
    }
    const visual = stateVisual(wt.state);
    void key.setImage(
      renderKey({
        color: visual.color,
        glyph: "❏",
        lines: [
          fit(wt.repo),
          fit(wt.branch),
          `${wt.agentCount} agent${wt.agentCount === 1 ? "" : "s"}`,
        ],
      })
    );
  }

  override onDialRotate(ev: DialRotateEvent<JsonObject>): void {
    context.store.stepWorktree(ev.payload.ticks >= 0 ? 1 : -1);
    this.renderAll(context.store.getSnapshot());
  }

  override async onDialDown(ev: DialDownEvent<JsonObject>): Promise<void> {
    await openSelectedWorktree(ev.action);
    this.renderAll(context.store.getSnapshot());
  }

  // oxlint-disable-next-line eslint/class-methods-use-this
  override async onKeyDown(ev: KeyDownEvent<JsonObject>): Promise<void> {
    await openSelectedWorktree(ev.action);
  }
}
