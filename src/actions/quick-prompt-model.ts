import type { NormalizedAgent } from "../orca/types.js";
import type { OrcaStore } from "../state/store.js";

export type QuickPromptTargetMode =
  | "active-agent"
  | "specific-agent"
  | "specific-worktree";

// Action settings reach the SDK through a JsonObject constraint, which an
// interface cannot satisfy: interfaces have no implicit index signature.
// oxlint-disable-next-line typescript/consistent-type-definitions
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

export const DEFAULT_QUICK_PROMPTS: { label: string; prompt: string }[] = [
  { label: "Continue", prompt: "Continue." },
  {
    label: "Run tests",
    prompt: "Run the relevant tests and report the results.",
  },
  {
    label: "Fix tests",
    prompt: "Run all relevant tests and fix any failures.",
  },
  {
    label: "Review changes",
    prompt: "Review the current changes for bugs and issues.",
  },
  { label: "Explain changes", prompt: "Explain the changes you just made." },
  { label: "Show diff", prompt: "Show me the current git diff." },
  {
    label: "Commit changes",
    prompt: "Commit the current changes with a clear message.",
  },
  {
    label: "Retry",
    prompt: "That didn't work. Please try a different approach.",
  },
];

export interface ResolvedTarget {
  worktreePath: string;
  titleHint: string | null;
}

export class QuickPromptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuickPromptError";
  }
}

export const resolveQuickPromptTarget = (
  settings: QuickPromptSettings,
  store: OrcaStore
): ResolvedTarget => {
  const mode = settings.target ?? "active-agent";

  if (mode === "specific-worktree") {
    if (!settings.worktreePath) {
      throw new QuickPromptError("No worktree configured.");
    }
    return {
      titleHint: settings.titleHint ?? null,
      worktreePath: settings.worktreePath,
    };
  }

  let agent: NormalizedAgent | null;
  if (mode === "specific-agent") {
    agent =
      store.getSnapshot().agents.find((a) => a.id === settings.agentId) ?? null;
    if (!agent) {
      throw new QuickPromptError("Configured agent not found.");
    }
  } else {
    agent = store.getSelectedAgent();
    if (!agent) {
      throw new QuickPromptError("No active agent.");
    }
  }
  return {
    titleHint: agent.terminalTitleHint ?? agent.agentType,
    worktreePath: agent.worktreePath,
  };
};

export const serializeQuickPrompt = (
  settings: QuickPromptSettings
): {
  text: string;
  enter: boolean;
} => {
  const text = (settings.prompt ?? "").trim();
  if (!text) {
    throw new QuickPromptError("Prompt text is empty.");
  }
  return { enter: settings.sendEnter !== false, text };
};

export const needsConfirmation = (settings: QuickPromptSettings): boolean =>
  settings.confirm === true;
