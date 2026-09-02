import { OrcaPoller } from "./state/poller.js";
import { OrcaStore } from "./state/store.js";
import type { OrcaSettings } from "./state/store.js";

export class PluginContext {
  readonly store = new OrcaStore();
  readonly poller = new OrcaPoller(this.store);

  applyGlobalSettings(settings: Partial<OrcaSettings>): void {
    this.store.updateSettings(settings);
  }
}

export const context = new PluginContext();
