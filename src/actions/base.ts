import { SingletonAction, streamDeck } from "@elgato/streamdeck";
import type {
  SendToPluginEvent,
  WillAppearEvent,
  WillDisappearEvent,
} from "@elgato/streamdeck";
import type { JsonObject, JsonValue } from "@elgato/utils";

import { context } from "../context.js";
import { logger } from "../logger.js";
import type { OrcaSnapshot } from "../orca/types.js";
import { buildPiState } from "./pi-state.js";

export abstract class OrcaAction<
  T extends JsonObject = JsonObject,
> extends SingletonAction<T> {
  /** Visible instances of THIS action, keyed by Stream Deck context id. */
  protected readonly visible = new Map<string, WillAppearEvent<T>["action"]>();
  private unsubscribe: (() => void) | null = null;

  override onWillAppear(ev: WillAppearEvent<T>): void | Promise<void> {
    this.visible.set(ev.action.id, ev.action);
    this.ensureSubscribed();
    return this.render(ev.action, context.store.getSnapshot());
  }

  override onWillDisappear(ev: WillDisappearEvent<T>): void {
    this.visible.delete(ev.action.id);
    if (this.visible.size === 0 && this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  private ensureSubscribed(): void {
    if (this.unsubscribe) {
      return;
    }
    this.unsubscribe = context.poller.subscribe((snapshot) => {
      this.renderAll(snapshot);
    });
  }

  /**
   * Draws every visible key. The try/catch is a barrier rather than a swallow:
   * one key that fails to draw must not stop the others, and this runs inside
   * a poller callback that must not throw. `render` may be async, so its
   * rejection is caught too — otherwise it escapes as an unhandled rejection.
   * Either way the failure is logged, so it shows up in the plugin log.
   */
  protected renderAll(snapshot: OrcaSnapshot): void {
    for (const key of this.visible.values()) {
      // oxlint-disable-next-line eslint/no-void
      void this.renderOne(key, snapshot);
    }
  }

  /** Draws one key, turning any failure into a log entry. */
  private async renderOne(
    key: WillAppearEvent<T>["action"],
    snapshot: OrcaSnapshot
  ): Promise<void> {
    try {
      await this.render(key, snapshot);
    } catch (error) {
      logger.error(`render failed for ${key.id}`, error);
    }
  }

  // oxlint-disable-next-line eslint/class-methods-use-this
  override async onSendToPlugin(
    ev: SendToPluginEvent<JsonValue, T>
  ): Promise<void> {
    const payload = ev.payload as { event?: string } | undefined;
    if (payload?.event === "refresh") {
      await context.poller.refreshNow();
      await streamDeck.ui.sendToPropertyInspector({
        event: "state",
        ...buildPiState(),
      });
    }
  }

  protected abstract render(
    key: WillAppearEvent<T>["action"],
    snapshot: OrcaSnapshot
  ): void | Promise<void>;
}
