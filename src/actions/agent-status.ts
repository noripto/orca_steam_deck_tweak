import { action } from "@elgato/streamdeck";
import type { KeyDownEvent, WillAppearEvent } from "@elgato/streamdeck";

import { context } from "../context.js";
import { logger } from "../logger.js";
import {
  openOrca,
  resolveTerminalHandle,
  terminalSwitch,
} from "../orca/api.js";
import type { NormalizedAgent, OrcaSnapshot } from "../orca/types.js";
import { fit, renderConnectionKey, renderKey, stateVisual } from "../render.js";
import { cliOptions } from "../state/store.js";
import { OrcaAction } from "./base.js";

// Action settings reach the SDK through a JsonObject constraint, which an
// interface cannot satisfy: interfaces have no implicit index signature.
// oxlint-disable-next-line typescript/consistent-type-definitions
type AgentStatusSettings = { slot?: number };

/** A key pinned to a fixed slot shows that agent; otherwise the active one. */
const pickAgent = (
  settings: AgentStatusSettings,
  snapshot: OrcaSnapshot
): NormalizedAgent | null => {
  if (typeof settings.slot === "number") {
    return snapshot.agents[settings.slot] ?? null;
  }
  return context.store.getSelectedAgent();
};

@action({ UUID: "dev.onorca.streamdeck.agent-status" })
export class AgentStatusAction extends OrcaAction<AgentStatusSettings> {
  // oxlint-disable-next-line eslint/class-methods-use-this
  protected async render(
    key: WillAppearEvent<AgentStatusSettings>["action"],
    snapshot: OrcaSnapshot
  ): Promise<void> {
    void key.setTitle("");
    if (snapshot.connection !== "online") {
      void key.setImage(renderConnectionKey(snapshot.connection, "AGENT"));
      return;
    }
    const settings = await key.getSettings();
    const agent = pickAgent(settings, snapshot);
    if (!agent) {
      void key.setImage(
        renderKey({ color: "#8a8f98", glyph: "—", lines: ["NO", "AGENT"] })
      );
      return;
    }
    const visual = stateVisual(agent.state);
    void key.setImage(
      renderKey({
        color: visual.color,
        glyph: visual.glyph,
        lines: [
          fit(agent.agentType ?? "agent"),
          fit(agent.label),
          visual.label,
        ],
      })
    );
  }

  // oxlint-disable-next-line eslint/class-methods-use-this
  override async onKeyDown(
    ev: KeyDownEvent<AgentStatusSettings>
  ): Promise<void> {
    const snapshot = context.store.getSnapshot();
    const agent = pickAgent(ev.payload.settings, snapshot);
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
      logger.error("failed to open agent", error);
      await ev.action.showAlert();
    }
    await context.poller.refreshNow();
  }
}
