import { action, type KeyDownEvent, type WillAppearEvent } from "@elgato/streamdeck";

import { context } from "../context.js";
import { openOrca, resolveTerminalHandle, terminalSwitch } from "../orca/api.js";
import { cliOptions } from "../state/store.js";
import type { NormalizedAgent, OrcaSnapshot } from "../orca/types.js";
import { fit, renderConnectionKey, renderKey, stateVisual } from "../render.js";
import { OrcaAction } from "./base.js";

type AgentStatusSettings = { slot?: number };

@action({ UUID: "dev.onorca.streamdeck.agent-status" })
export class AgentStatusAction extends OrcaAction<AgentStatusSettings> {
  private pickAgent(settings: AgentStatusSettings, snapshot: OrcaSnapshot): NormalizedAgent | null {
    if (typeof settings.slot === "number") {
      return snapshot.agents[settings.slot] ?? null;
    }
    return context.store.getSelectedAgent();
  }

  protected async render(
    action: WillAppearEvent<AgentStatusSettings>["action"],
    snapshot: OrcaSnapshot,
  ): Promise<void> {
    void action.setTitle("");
    if (snapshot.connection !== "online") {
      void action.setImage(renderConnectionKey(snapshot.connection, "AGENT"));
      return;
    }
    const settings = await action.getSettings();
    const agent = this.pickAgent(settings, snapshot);
    if (!agent) {
      void action.setImage(renderKey({ glyph: "—", color: "#8a8f98", lines: ["NO", "AGENT"] }));
      return;
    }
    const visual = stateVisual(agent.state);
    void action.setImage(
      renderKey({
        glyph: visual.glyph,
        color: visual.color,
        lines: [fit(agent.agentType ?? "agent"), fit(agent.label), visual.label],
      }),
    );
  }

  override async onKeyDown(ev: KeyDownEvent<AgentStatusSettings>): Promise<void> {
    const snapshot = context.store.getSnapshot();
    const agent = this.pickAgent(ev.payload.settings, snapshot);
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
