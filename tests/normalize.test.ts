import { describe, expect, it } from "vitest";

import {
  countByState,
  normalizeAgentState,
  normalizeAgentWait,
  normalizeWorktreeStatus,
  normalizeWorktrees,
} from "../src/orca/normalize.js";
import type { OrcaWorktreeSummary } from "../src/orca/types.js";

describe("state normalization", () => {
  it("maps raw agent states", () => {
    expect(normalizeAgentState("working")).toBe("working");
    expect(normalizeAgentState("waiting")).toBe("waiting");
    expect(normalizeAgentState("blocked")).toBe("waiting");
    expect(normalizeAgentState("done")).toBe("done");
    expect(normalizeAgentState("idle")).toBe("idle");
    expect(normalizeAgentState("garbage")).toBe("unknown");
    expect(normalizeAgentState(undefined)).toBe("unknown");
  });

  it("maps worktree fallback status", () => {
    expect(normalizeWorktreeStatus("permission")).toBe("waiting");
    expect(normalizeWorktreeStatus("working")).toBe("working");
    expect(normalizeWorktreeStatus("active")).toBe("idle");
    expect(normalizeWorktreeStatus("inactive")).toBe("idle");
  });

  it("maps terminal agentWait", () => {
    expect(normalizeAgentWait(undefined)).toBe("unknown");
    expect(normalizeAgentWait(false)).toBe("working");
    expect(normalizeAgentWait({ source: "hook", reason: "prompt" })).toBe("waiting");
  });
});

function wt(partial: Partial<OrcaWorktreeSummary>): OrcaWorktreeSummary {
  return {
    worktreeId: "repo::/w",
    repoId: "repo",
    repo: "myrepo",
    path: "/w",
    branch: "main",
    liveTerminalCount: 0,
    hasAttachedPty: false,
    status: "inactive",
    agents: [],
    ...partial,
  };
}

describe("normalizeWorktrees", () => {
  it("prefers per-agent hook rows and derives urgent worktree state", () => {
    const { agents, worktrees } = normalizeWorktrees([
      wt({
        path: "/a",
        agents: [
          { paneKey: "p1", state: "working", agentType: "claude" },
          { paneKey: "p2", state: "waiting", agentType: "codex" },
        ],
      }),
    ]);
    expect(agents).toHaveLength(2);
    expect(agents[0]).toMatchObject({ id: "p1", agentType: "claude", state: "working" });
    expect(worktrees[0]!.state).toBe("waiting");
    expect(worktrees[0]!.agentCount).toBe(2);
  });

  it("falls back to a synthetic agent when live but no hook rows", () => {
    const { agents } = normalizeWorktrees([
      wt({ path: "/b", liveTerminalCount: 1, status: "permission", agents: [] }),
    ]);
    expect(agents).toHaveLength(1);
    expect(agents[0]).toMatchObject({ id: "wt:/b#0", state: "waiting" });
  });

  it("emits no agent for a dormant worktree", () => {
    const { agents, worktrees } = normalizeWorktrees([
      wt({ path: "/c", liveTerminalCount: 0, status: "inactive", agents: [] }),
    ]);
    expect(agents).toHaveLength(0);
    expect(worktrees).toHaveLength(1);
  });

  it("counts agents by state", () => {
    const { agents } = normalizeWorktrees([
      wt({
        path: "/d",
        agents: [
          { paneKey: "a", state: "working", agentType: "claude" },
          { paneKey: "b", state: "waiting", agentType: "codex" },
          { paneKey: "c", state: "done", agentType: "claude" },
        ],
      }),
    ]);
    expect(countByState(agents)).toMatchObject({
      working: 1,
      waiting: 1,
      done: 1,
      idle: 0,
      unknown: 0,
    });
  });
});
