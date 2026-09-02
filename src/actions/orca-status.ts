import type { KeyDownEvent } from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";

import { context } from "../context.js";
import { ACTION_UUID } from "../uuid.js";
import { logger } from "../logger.js";
import { openOrca } from "../orca/api.js";
import type { OrcaSnapshot } from "../orca/types.js";
import { renderConnectionKey, renderKey } from "../render.js";
import { cliOptions } from "../state/store.js";
import { OrcaAction } from "./base.js";

export class OrcaStatusAction extends OrcaAction {
  override readonly manifestId = ACTION_UUID.orcaStatus;

  // oxlint-disable-next-line eslint/class-methods-use-this
  protected render(
    key: KeyDownEvent<JsonObject>["action"],
    snapshot: OrcaSnapshot
  ): void {
    void key.setTitle("");
    if (snapshot.connection !== "online") {
      void key.setImage(renderConnectionKey(snapshot.connection));
      return;
    }
    const { counts } = snapshot;
    void key.setImage(
      renderKey({
        color: counts.waiting > 0 ? "#f5a623" : "#33c26a",
        glyph: "◆",
        lines: [
          `${counts.waiting} NEED`,
          `${counts.working} WORK`,
          `${counts.done} DONE`,
        ],
      })
    );
  }

  // oxlint-disable-next-line eslint/class-methods-use-this
  override async onKeyDown(ev: KeyDownEvent<JsonObject>): Promise<void> {
    const snapshot = context.store.getSnapshot();
    if (snapshot.connection === "cli-missing") {
      return;
    }
    try {
      await openOrca(cliOptions(context.store.getSettings()));
    } catch (error) {
      logger.error("failed to bring Orca to the front", error);
      await ev.action.showAlert();
    }
    await context.poller.refreshNow();
  }
}
