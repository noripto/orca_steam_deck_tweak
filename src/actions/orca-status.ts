import { action, type KeyDownEvent } from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";

import { context } from "../context.js";
import { openOrca } from "../orca/api.js";
import { cliOptions } from "../state/store.js";
import type { OrcaSnapshot } from "../orca/types.js";
import { renderConnectionKey, renderKey } from "../render.js";
import { OrcaAction } from "./base.js";


@action({ UUID: "dev.onorca.streamdeck.orca-status" })
export class OrcaStatusAction extends OrcaAction {
  protected render(action: KeyDownEvent<JsonObject>["action"], snapshot: OrcaSnapshot): void {
    void action.setTitle("");
    if (snapshot.connection !== "online") {
      void action.setImage(renderConnectionKey(snapshot.connection));
      return;
    }
    const { counts } = snapshot;
    void action.setImage(
      renderKey({
        glyph: "◆",
        color: counts.waiting > 0 ? "#f5a623" : "#33c26a",
        lines: [
          `${counts.waiting} NEED`,
          `${counts.working} WORK`,
          `${counts.done} DONE`
        ]
      })
    );
  }

  override async onKeyDown(_ev: KeyDownEvent<JsonObject>): Promise<void> {
    const snapshot = context.store.getSnapshot();
    if (snapshot.connection === "cli-missing") return;
    try {
      await openOrca(cliOptions(context.store.getSettings()));
    } catch {
      throw new Error("not reflect new state")
    }
    await context.poller.refreshNow();
  }
}
