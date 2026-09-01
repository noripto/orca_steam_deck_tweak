import { describe, expect, it } from "vitest";

import {
  needsConfirmation,
  QuickPromptError,
  resolveQuickPromptTarget,
  serializeQuickPrompt,
  type QuickPromptSettings
} from "../src/actions/quick-prompt-model.js";
import { OrcaStore } from "../src/state/store.js";
import type { NormalizedAgent } from "../src/orca/types.js";

function storeWith(agents: NormalizedAgent[], selected?: string): OrcaStore {
  const store = new OrcaStore();
  (store as unknown as { snapshot: unknown }).snapshot = {
    connection: "online",
    agents,
    worktrees: [],
    counts: { working: 0, waiting: 0, done: 0, idle: 0, unknown: 0 },
    hooksEnabled: true,
    updatedAt: 0
  };
  if (selected) store.selectAgentId(selected);
  return store;
}

const agent = (id: string, path: string): NormalizedAgent => ({
  id,
  worktreeId: `repo::${path}`,
  worktreePath: path,
  repo: "r",
  branch: "b",
  label: id,
  agentType: "claude",
  state: "working",
  terminalTitleHint: "claude"
});

describe("serializeQuickPrompt", () => {
  it("trims prompt and defaults sendEnter to true", () => {
    expect(serializeQuickPrompt({ prompt: "  run tests  " })).toEqual({ text: "run tests", enter: true });
  });

  it("respects sendEnter=false", () => {
    expect(serializeQuickPrompt({ prompt: "x", sendEnter: false })).toEqual({ text: "x", enter: false });
  });

  it("throws on empty prompt", () => {
    expect(() => serializeQuickPrompt({ prompt: "   " })).toThrow(QuickPromptError);
  });
});

describe("resolveQuickPromptTarget", () => {
  it("uses the active agent by default", () => {
    const store = storeWith([agent("p1", "/a")]);
    expect(resolveQuickPromptTarget({}, store)).toEqual({ worktreePath: "/a", titleHint: "claude" });
  });

  it("resolves a specific agent by id", () => {
    const store = storeWith([agent("p1", "/a"), agent("p2", "/b")]);
    const s: QuickPromptSettings = { target: "specific-agent", agentId: "p2" };
    expect(resolveQuickPromptTarget(s, store).worktreePath).toBe("/b");
  });

  it("throws for a missing specific agent", () => {
    const store = storeWith([agent("p1", "/a")]);
    expect(() => resolveQuickPromptTarget({ target: "specific-agent", agentId: "zzz" }, store)).toThrow(
      QuickPromptError
    );
  });

  it("resolves a specific worktree", () => {
    const store = storeWith([]);
    const s: QuickPromptSettings = { target: "specific-worktree", worktreePath: "/w", titleHint: "codex" };
    expect(resolveQuickPromptTarget(s, store)).toEqual({ worktreePath: "/w", titleHint: "codex" });
  });

  it("throws when no active agent exists", () => {
    const store = storeWith([]);
    expect(() => resolveQuickPromptTarget({}, store)).toThrow(QuickPromptError);
  });
});

describe("needsConfirmation", () => {
  it("only when explicitly enabled", () => {
    expect(needsConfirmation({ confirm: true })).toBe(true);
    expect(needsConfirmation({})).toBe(false);
  });
});
