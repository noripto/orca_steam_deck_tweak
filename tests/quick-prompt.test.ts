import { describe, expect, it } from "vite-plus/test";

import {
  needsConfirmation,
  QuickPromptError,
  resolveQuickPromptTarget,
  serializeQuickPrompt,
} from "../src/actions/quick-prompt-model.js";
import type { QuickPromptSettings } from "../src/actions/quick-prompt-model.js";
import type { NormalizedAgent } from "../src/orca/types.js";
import { OrcaStore } from "../src/state/store.js";

const storeWith = (agents: NormalizedAgent[], selected?: string): OrcaStore => {
  const store = new OrcaStore();
  (store as unknown as { snapshot: unknown }).snapshot = {
    agents,
    connection: "online",
    counts: { done: 0, idle: 0, unknown: 0, waiting: 0, working: 0 },
    hooksEnabled: true,
    updatedAt: 0,
    worktrees: [],
  };
  if (selected) {
    store.selectAgentId(selected);
  }
  return store;
};

const agent = (id: string, path: string): NormalizedAgent => ({
  agentType: "claude",
  branch: "b",
  id,
  label: id,
  repo: "r",
  state: "working",
  terminalTitleHint: "claude",
  worktreeId: `repo::${path}`,
  worktreePath: path,
});

describe("serializeQuickPrompt", () => {
  it("trims prompt and defaults sendEnter to true", () => {
    expect(serializeQuickPrompt({ prompt: "  run tests  " })).toEqual({
      enter: true,
      text: "run tests",
    });
  });

  it("respects sendEnter=false", () => {
    expect(serializeQuickPrompt({ prompt: "x", sendEnter: false })).toEqual({
      enter: false,
      text: "x",
    });
  });

  it("throws on empty prompt", () => {
    expect(() => serializeQuickPrompt({ prompt: "   " })).toThrow(
      QuickPromptError
    );
  });
});

describe("resolveQuickPromptTarget", () => {
  it("uses the active agent by default", () => {
    const store = storeWith([agent("p1", "/a")]);
    expect(resolveQuickPromptTarget({}, store)).toEqual({
      titleHint: "claude",
      worktreePath: "/a",
    });
  });

  it("resolves a specific agent by id", () => {
    const store = storeWith([agent("p1", "/a"), agent("p2", "/b")]);
    const s: QuickPromptSettings = { agentId: "p2", target: "specific-agent" };
    expect(resolveQuickPromptTarget(s, store).worktreePath).toBe("/b");
  });

  it("throws for a missing specific agent", () => {
    const store = storeWith([agent("p1", "/a")]);
    expect(() =>
      resolveQuickPromptTarget(
        { agentId: "zzz", target: "specific-agent" },
        store
      )
    ).toThrow(QuickPromptError);
  });

  it("resolves a specific worktree", () => {
    const store = storeWith([]);
    const s: QuickPromptSettings = {
      target: "specific-worktree",
      titleHint: "codex",
      worktreePath: "/w",
    };
    expect(resolveQuickPromptTarget(s, store)).toEqual({
      titleHint: "codex",
      worktreePath: "/w",
    });
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
