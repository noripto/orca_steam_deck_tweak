import type { OrcaStore } from "../state/store.js";
import type { NormalizedAgent } from "../orca/types.js";

export type QuickPromptTargetMode = "active-agent" | "specific-agent" | "specific-worktree";

export type QuickPromptSettings = {
  label?: string;
  prompt?: string;
  target?: QuickPromptTargetMode;
  agentId?: string;
  worktreePath?: string;
  titleHint?: string;
  sendEnter?: boolean;
  confirm?: boolean;
};

export const DEFAULT_QUICK_PROMPTS: Array<{ label: string; prompt: string }> = [
  { label: "Continue", prompt: "Continue." },
  { label: "Run tests", prompt: "Run the relevant tests and report the results." },
  { label: "Fix tests", prompt: "Run all relevant tests and fix any failures." },
  { label: "Review changes", prompt: "Review the current changes for bugs and issues." },
  { label: "Explain changes", prompt: "Explain the changes you just made." },
  { label: "Show diff", prompt: "Show me the current git diff." },
  { label: "Commit changes", prompt: "Commit the current changes with a clear message." },
  { label: "Retry", prompt: "That didn't work. Please try a different approach." },
];

export interface ResolvedTarget {
  worktreePath: string;
  titleHint: string | null;
}

export class QuickPromptError extends Error {}

export function resolveQuickPromptTarget(
  settings: QuickPromptSettings,
  store: OrcaStore,
): ResolvedTarget {
  const mode = settings.target ?? "active-agent";

  if (mode === "specific-worktree") {
    if (!settings.worktreePath) {
      throw new QuickPromptError("No worktree configured.");
    }
    return { worktreePath: settings.worktreePath, titleHint: settings.titleHint ?? null };
  }

  let agent: NormalizedAgent | null;
  if (mode === "specific-agent") {
    agent = store.getSnapshot().agents.find((a) => a.id === settings.agentId) ?? null;
    if (!agent) throw new QuickPromptError("Configured agent not found.");
  } else {
    agent = store.getSelectedAgent();
    if (!agent) throw new QuickPromptError("No active agent.");
  }
  return {
    worktreePath: agent.worktreePath,
    titleHint: agent.terminalTitleHint ?? agent.agentType,
  };
}

export function serializeQuickPrompt(settings: QuickPromptSettings): {
  text: string;
  enter: boolean;
} {
  const text = (settings.prompt ?? "").trim();
  if (!text) {
    throw new QuickPromptError("Prompt text is empty.");
  }
  return { text, enter: settings.sendEnter !== false };
}

export function needsConfirmation(settings: QuickPromptSettings): boolean {
  return settings.confirm === true;
}
