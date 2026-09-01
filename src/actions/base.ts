import streamDeck, {
  SingletonAction,
  type WillAppearEvent,
  type WillDisappearEvent,
  type SendToPluginEvent
} from "@elgato/streamdeck";
import type { JsonObject, JsonValue } from "@elgato/utils";

import { context } from "../context.js";
import { buildPiState } from "./pi-state.js";
import type { OrcaSnapshot } from "../orca/types.js";

export abstract class OrcaAction<T extends JsonObject = JsonObject> extends SingletonAction<T> {
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
    if (this.unsubscribe) return;
    this.unsubscribe = context.poller.subscribe((snapshot) => this.renderAll(snapshot));
  }

  protected renderAll(snapshot: OrcaSnapshot): void {
    for (const action of this.visible.values()) {
      try {
        void this.render(action, snapshot);
      } catch {
        throw new Error("no render content")
      }
    }
  }

 
  override async onSendToPlugin(ev: SendToPluginEvent<JsonValue, T>): Promise<void> {
    const payload = ev.payload as { event?: string } | undefined;
    if (payload?.event === "refresh") {
      await context.poller.refreshNow();
      await streamDeck.ui.sendToPropertyInspector({
        event: "state",
        ...buildPiState()
      });
    }
  }

  protected abstract render(
    action: WillAppearEvent<T>["action"],
    snapshot: OrcaSnapshot
  ): void | Promise<void>;
}
