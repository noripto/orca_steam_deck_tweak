import { action } from "@elgato/streamdeck";
import type { KeyDownEvent, WillAppearEvent } from "@elgato/streamdeck";

import { context } from "../context.js";
import { resolveTerminalHandle, terminalSend } from "../orca/api.js";
import type { OrcaSnapshot } from "../orca/types.js";
import { fit, renderConnectionKey, renderKey } from "../render.js";
import { cliOptions } from "../state/store.js";
import { OrcaAction } from "./base.js";
import {
  needsConfirmation,
  QuickPromptError,
  resolveQuickPromptTarget,
  serializeQuickPrompt,
} from "./quick-prompt-model.js";
import type { QuickPromptSettings } from "./quick-prompt-model.js";

/** Splits a button label onto two key lines at the first run of spaces. */
const splitLabel = (label: string): string[] => {
  const [head, ...rest] = label.split(/\s+/u);
  if (head === undefined || rest.length === 0) {
    return [fit(label)];
  }
  return [fit(head), fit(rest.join(" "))];
};

@action({ UUID: "dev.onorca.streamdeck.quick-prompt" })
export class QuickPromptAction extends OrcaAction<QuickPromptSettings> {
  private armed = new Map<string, number>();

  // oxlint-disable-next-line eslint/class-methods-use-this
  protected async render(
    key: WillAppearEvent<QuickPromptSettings>["action"],
    snapshot: OrcaSnapshot
  ): Promise<void> {
    void key.setTitle("");
    const settings = await key.getSettings();
    const label = settings.label?.trim() || "PROMPT";
    if (snapshot.connection !== "online") {
      void key.setImage(renderConnectionKey(snapshot.connection, fit(label)));
      return;
    }
    void key.setImage(
      renderKey({ color: "#4a90e2", glyph: "➤", lines: splitLabel(label) })
    );
  }

  override async onKeyDown(
    ev: KeyDownEvent<QuickPromptSettings>
  ): Promise<void> {
    const { settings } = ev.payload;
    const { id } = ev.action;

    if (needsConfirmation(settings)) {
      const armedAt = this.armed.get(id);
      if (!armedAt || Date.now() - armedAt > 3000) {
        this.armed.set(id, Date.now());
        void ev.action.setImage(
          renderKey({
            color: "#f5a623",
            glyph: "?",
            lines: ["CONFIRM", "TAP AGAIN"],
          })
        );
        return;
      }
      this.armed.delete(id);
    }

    const opts = cliOptions(context.store.getSettings());
    try {
      const { text, enter } = serializeQuickPrompt(settings);
      const target = resolveQuickPromptTarget(settings, context.store);
      const handle = await resolveTerminalHandle(
        target.worktreePath,
        target.titleHint,
        opts
      );
      if (!handle) {
        throw new QuickPromptError("No terminal found for target.");
      }

      const accepted = await terminalSend({ enter, handle, text }, opts);
      await (accepted ? ev.action.showOk() : ev.action.showAlert());
    } catch (error) {
      if (error instanceof QuickPromptError) {
        void ev.action.setImage(
          renderKey({
            color: "#e0555b",
            glyph: "!",
            lines: ["ERROR", fit(error.message, 12)],
          })
        );
      }
      await ev.action.showAlert();
    } finally {
      // Repaint normal face shortly after.
      setTimeout(() => this.renderAll(context.store.getSnapshot()), 1200);
      await context.poller.refreshNow();
    }
  }
}
