import { action, type KeyDownEvent } from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";

import { context } from "../context.js";
import { openOrca, resolveTerminalHandle, terminalSwitch } from "../orca/api.js";
import { cliOptions } from "../state/store.js";
import type { OrcaSnapshot } from "../orca/types.js";
import { renderConnectionKey, renderKey } from "../render.js";
import { OrcaAction } from "./base.js";


@action({ UUID: "dev.onorca.streamdeck.needs-input" })
export class NeedsInputAction extends OrcaAction {
  protected render(action: KeyDownEvent<JsonObject>["action"], snapshot: OrcaSnapshot): void {
    void action.setTitle("");
    if (snapshot.connection !== "online") {
      void action.setImage(renderConnectionKey(snapshot.connection, "NEEDS"));
      return;
    }
    const waiting = snapshot.counts.waiting;
    if (waiting === 0) {
      void action.setImage(renderKey({ glyph: "✓", color: "#33c26a", lines: ["CLEAR"] }));
      return;
    }
    void action.setImage(
      renderKey({ glyph: "!", color: "#f5a623", lines: ["NEEDS", String(waiting)] })
    );
  }

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
      const handle = await resolveTerminalHandle(agent.worktreePath, agent.terminalTitleHint, opts);
      if (handle) await terminalSwitch(handle, opts);
      await ev.action.showOk();
    } catch {
      await ev.action.showAlert();
    }
    await context.poller.refreshNow();
  }
}
