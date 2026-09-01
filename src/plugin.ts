import streamDeck from "@elgato/streamdeck";

import { context } from "./context.js";
import { DEFAULT_SETTINGS, type OrcaSettings } from "./state/store.js";
import { OrcaStatusAction } from "./actions/orca-status.js";
import { NeedsInputAction } from "./actions/needs-input.js";
import { AgentStatusAction } from "./actions/agent-status.js";
import { QuickPromptAction } from "./actions/quick-prompt.js";
import {
  NextAgentAction,
  NextWorktreeAction,
  PrevAgentAction,
  PrevWorktreeAction
} from "./actions/selectors.js";
import { OpenAgentAction } from "./actions/open-agent.js";
import { WorktreeStatusAction } from "./actions/worktree-status.js";

function coerceSettings(raw: Record<string, unknown>): Partial<OrcaSettings> {
  const patch: Partial<OrcaSettings> = {};
  if (typeof raw.cliPath === "string") patch.cliPath = raw.cliPath;
  if (typeof raw.pollSeconds === "number") patch.pollSeconds = raw.pollSeconds;
  else if (typeof raw.pollSeconds === "string" && raw.pollSeconds.trim() !== "") {
    const n = Number(raw.pollSeconds);
    if (Number.isFinite(n)) patch.pollSeconds = n;
  }
  return patch;
}

streamDeck.settings.onDidReceiveGlobalSettings((ev) => {
  context.applyGlobalSettings(coerceSettings(ev.settings as Record<string, unknown>));
  void context.poller.refreshNow();
});

streamDeck.actions.registerAction(new OrcaStatusAction());
streamDeck.actions.registerAction(new NeedsInputAction());
streamDeck.actions.registerAction(new AgentStatusAction());
streamDeck.actions.registerAction(new QuickPromptAction());
streamDeck.actions.registerAction(new PrevAgentAction());
streamDeck.actions.registerAction(new NextAgentAction());
streamDeck.actions.registerAction(new PrevWorktreeAction());
streamDeck.actions.registerAction(new NextWorktreeAction());
streamDeck.actions.registerAction(new OpenAgentAction());
streamDeck.actions.registerAction(new WorktreeStatusAction());

(async () => {
  await streamDeck.connect();

  try {
    const global = (await streamDeck.settings.getGlobalSettings()) as Record<string, unknown>;
    const patch = coerceSettings(global);
    context.applyGlobalSettings({ ...DEFAULT_SETTINGS, ...patch });
  } catch {
    context.applyGlobalSettings(DEFAULT_SETTINGS);
  }

  context.poller.start();
})();
