import { action, type KeyDownEvent, type WillAppearEvent } from "@elgato/streamdeck";

import { context } from "../context.js";
import { resolveTerminalHandle, terminalSend } from "../orca/api.js";
import { cliOptions } from "../state/store.js";
import type { OrcaSnapshot } from "../orca/types.js";
import { fit, renderConnectionKey, renderKey } from "../render.js";
import { OrcaAction } from "./base.js";
import {
  needsConfirmation,
  QuickPromptError,
  resolveQuickPromptTarget,
  serializeQuickPrompt,
  type QuickPromptSettings,
} from "./quick-prompt-model.js";

@action({ UUID: "dev.onorca.streamdeck.quick-prompt" })
export class QuickPromptAction extends OrcaAction<QuickPromptSettings> {
  private armed = new Map<string, number>();

  protected async render(
    action: WillAppearEvent<QuickPromptSettings>["action"],
    snapshot: OrcaSnapshot,
  ): Promise<void> {
    void action.setTitle("");
    const settings = await action.getSettings();
    const label = settings.label?.trim() || "PROMPT";
    if (snapshot.connection !== "online") {
      void action.setImage(renderConnectionKey(snapshot.connection, fit(label)));
      return;
    }
    void action.setImage(
      renderKey({ glyph: "➤", color: "#4a90e2", lines: this.splitLabel(label) }),
    );
  }

  private splitLabel(label: string): string[] {
    const parts = label.split(/\s+/);
    if (parts.length <= 1) return [fit(label)];
    return [fit(parts[0]!), fit(parts.slice(1).join(" "))];
  }

  override async onKeyDown(ev: KeyDownEvent<QuickPromptSettings>): Promise<void> {
    const settings = ev.payload.settings;
    const id = ev.action.id;

    if (needsConfirmation(settings)) {
      const armedAt = this.armed.get(id);
      if (!armedAt || Date.now() - armedAt > 3000) {
        this.armed.set(id, Date.now());
        void ev.action.setImage(
          renderKey({ glyph: "?", color: "#f5a623", lines: ["CONFIRM", "TAP AGAIN"] }),
        );
        return;
      }
      this.armed.delete(id);
    }

    const opts = cliOptions(context.store.getSettings());
    try {
      const { text, enter } = serializeQuickPrompt(settings);
      const target = resolveQuickPromptTarget(settings, context.store);
      const handle = await resolveTerminalHandle(target.worktreePath, target.titleHint, opts);
      if (!handle) throw new QuickPromptError("No terminal found for target.");

      const accepted = await terminalSend({ handle, text, enter }, opts);
      if (accepted) await ev.action.showOk();
      else await ev.action.showAlert();
    } catch (err) {
      if (err instanceof QuickPromptError) {
        void ev.action.setImage(
          renderKey({ glyph: "!", color: "#e0555b", lines: ["ERROR", fit(err.message, 12)] }),
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
