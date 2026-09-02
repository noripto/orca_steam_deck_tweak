import { describe, expect, it } from "vite-plus/test";

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
    expect(normalizeAgentState()).toBe("unknown");
  });

  it("maps worktree fallback status", () => {
    expect(normalizeWorktreeStatus("permission")).toBe("waiting");
    expect(normalizeWorktreeStatus("working")).toBe("working");
    expect(normalizeWorktreeStatus("active")).toBe("idle");
    expect(normalizeWorktreeStatus("inactive")).toBe("idle");
  });

  it("maps terminal agentWait", () => {
    expect(normalizeAgentWait()).toBe("unknown");
    expect(normalizeAgentWait(false)).toBe("working");
    expect(normalizeAgentWait({ reason: "prompt", source: "hook" })).toBe(
      "waiting"
    );
  });
});

const wt = (partial: Partial<OrcaWorktreeSummary>): OrcaWorktreeSummary => ({
  agents: [],
  branch: "main",
  hasAttachedPty: false,
  liveTerminalCount: 0,
  path: "/w",
  repo: "myrepo",
  repoId: "repo",
  status: "inactive",
  worktreeId: "repo::/w",
  ...partial,
});

describe("normalizeWorktrees", () => {
  it("prefers per-agent hook rows and derives urgent worktree state", () => {
    const { agents, worktrees } = normalizeWorktrees([
      wt({
        agents: [
          { agentType: "claude", paneKey: "p1", state: "working" },
          { agentType: "codex", paneKey: "p2", state: "waiting" },
        ],
        path: "/a",
      }),
    ]);
    expect(agents).toHaveLength(2);
    expect(agents[0]).toMatchObject({
      agentType: "claude",
      id: "p1",
      state: "working",
    });
    const [firstWorktree] = worktrees;
    expect(firstWorktree?.state).toBe("waiting");
    expect(firstWorktree?.agentCount).toBe(2);
  });

  it("falls back to a synthetic agent when live but no hook rows", () => {
    const { agents } = normalizeWorktrees([
      wt({
        agents: [],
        liveTerminalCount: 1,
        path: "/b",
        status: "permission",
      }),
    ]);
    expect(agents).toHaveLength(1);
    expect(agents[0]).toMatchObject({ id: "wt:/b#0", state: "waiting" });
  });

  it("emits no agent for a dormant worktree", () => {
    const { agents, worktrees } = normalizeWorktrees([
      wt({ agents: [], liveTerminalCount: 0, path: "/c", status: "inactive" }),
    ]);
    expect(agents).toHaveLength(0);
    expect(worktrees).toHaveLength(1);
  });

  it("counts agents by state", () => {
    const { agents } = normalizeWorktrees([
      wt({
        agents: [
          { agentType: "claude", paneKey: "a", state: "working" },
          { agentType: "codex", paneKey: "b", state: "waiting" },
          { agentType: "claude", paneKey: "c", state: "done" },
        ],
        path: "/d",
      }),
    ]);
    expect(countByState(agents)).toMatchObject({
      done: 1,
      idle: 0,
      unknown: 0,
      waiting: 1,
      working: 1,
    });
  });
});
