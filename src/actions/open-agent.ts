import { action } from "@elgato/streamdeck";
import type { KeyDownEvent, WillAppearEvent } from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";

import { context } from "../context.js";
import {
  openOrca,
  resolveTerminalHandle,
  terminalSwitch,
} from "../orca/api.js";
import type { OrcaSnapshot } from "../orca/types.js";
import { fit, renderConnectionKey, renderKey, stateVisual } from "../render.js";
import { cliOptions } from "../state/store.js";
import { OrcaAction } from "./base.js";

@action({ UUID: "dev.onorca.streamdeck.open-agent" })
export class OpenAgentAction extends OrcaAction {
  // oxlint-disable-next-line eslint/class-methods-use-this
  protected render(
    key: WillAppearEvent<JsonObject>["action"],
    snapshot: OrcaSnapshot
  ): void {
    void key.setTitle("");
    if (snapshot.connection !== "online") {
      void key.setImage(renderConnectionKey(snapshot.connection, "OPEN"));
      return;
    }
    const agent = context.store.getSelectedAgent();
    if (!agent) {
      void key.setImage(
        renderKey({ color: "#8a8f98", glyph: "⇱", lines: ["OPEN", "NO AGENT"] })
      );
      return;
    }
    const visual = stateVisual(agent.state);
    void key.setImage(
      renderKey({
        color: visual.color,
        glyph: "⇱",
        lines: ["OPEN", fit(agent.label), visual.label],
      })
    );
  }

  // oxlint-disable-next-line eslint/class-methods-use-this
  override async onKeyDown(ev: KeyDownEvent<JsonObject>): Promise<void> {
    const agent = context.store.getSelectedAgent();
    if (!agent) {
      await ev.action.showAlert();
      return;
    }
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
    } catch {
      await ev.action.showAlert();
    }
    await context.poller.refreshNow();
  }
}
