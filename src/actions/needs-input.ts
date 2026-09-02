import type { KeyDownEvent } from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";

import { context } from "../context.js";
import { logger } from "../logger.js";
import {
  openOrca,
  resolveTerminalHandle,
  terminalSwitch,
} from "../orca/api.js";
import type { OrcaSnapshot } from "../orca/types.js";
import { renderConnectionKey, renderKey } from "../render.js";
import { cliOptions } from "../state/store.js";
import { ACTION_UUID } from "../uuid.js";
import { OrcaAction } from "./base.js";

export class NeedsInputAction extends OrcaAction {
  override readonly manifestId = ACTION_UUID.needsInput;

  // oxlint-disable-next-line eslint/class-methods-use-this
  protected render(
    key: KeyDownEvent<JsonObject>["action"],
    snapshot: OrcaSnapshot
  ): void {
    void key.setTitle("");
    if (snapshot.connection !== "online") {
      void key.setImage(renderConnectionKey(snapshot.connection, "NEEDS"));
      return;
    }
    const { waiting } = snapshot.counts;
    if (waiting === 0) {
      void key.setImage(
        renderKey({ color: "#33c26a", glyph: "✓", lines: ["CLEAR"] })
      );
      return;
    }
    void key.setImage(
      renderKey({
        color: "#f5a623",
        glyph: "!",
        lines: ["NEEDS", String(waiting)],
      })
    );
  }

  // oxlint-disable-next-line eslint/class-methods-use-this
  override async onKeyDown(ev: KeyDownEvent<JsonObject>): Promise<void> {
    const agent = context.store.getNeedsInputAgent();
    if (!agent) {
      await ev.action.showAlert();
      return;
    }
    context.store.selectAgentId(agent.id);
    const opts = cliOptions(context.store.getSettings());
    try {
      await openOrca(opts);
      const handle = await resolveTerminalHandle(
        agent.worktreePath,
        agent.terminalTitleHint,
        opts
      );
      if (handle) {
        await terminalSwitch(handle, opts);
      }
      await ev.action.showOk();
    } catch (error) {
      logger.error("failed to open the waiting agent", error);
      await ev.action.showAlert();
    }
    await context.poller.refreshNow();
  }
}
