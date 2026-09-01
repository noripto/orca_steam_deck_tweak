import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/orca/api.js", () => ({
  getStatus: vi.fn(),
  worktreePs: vi.fn(),
  agentHooksStatus: vi.fn()
}));

import { getStatus, worktreePs, agentHooksStatus } from "../src/orca/api.js";
import { OrcaStore } from "../src/state/store.js";
import type { OrcaWorktreeSummary } from "../src/orca/types.js";

const mockGetStatus = vi.mocked(getStatus);
const mockWorktreePs = vi.mocked(worktreePs);
const mockHooks = vi.mocked(agentHooksStatus);

function wt(path: string, agents: OrcaWorktreeSummary["agents"]): OrcaWorktreeSummary {
  return {
    worktreeId: `repo::${path}`,
    repoId: "repo",
    repo: "myrepo",
    path,
    branch: path.replace("/", ""),
    liveTerminalCount: agents.length,
    hasAttachedPty: agents.length > 0,
    status: "working",
    agents
  };
}

async function onlineStore(): Promise<OrcaStore> {
  mockGetStatus.mockResolvedValue({ connection: "online", raw: undefined });
  mockHooks.mockResolvedValue({ enabled: true, settingsPath: "", appliedBy: "runtime", statuses: [] });
  mockWorktreePs.mockResolvedValue([
    wt("/a", [
      { paneKey: "p1", state: "working", agentType: "claude" },
      { paneKey: "p2", state: "waiting", agentType: "codex" }
    ]),
    wt("/b", [{ paneKey: "p3", state: "idle", agentType: "claude" }])
  ]);
  const store = new OrcaStore();
  await store.refresh();
  return store;
}

describe("OrcaStore", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reports offline without querying worktrees", async () => {
    mockGetStatus.mockResolvedValue({ connection: "offline" });
    const store = new OrcaStore();
    const snap = await store.refresh();
    expect(snap.connection).toBe("offline");
    expect(snap.agents).toHaveLength(0);
    expect(mockWorktreePs).not.toHaveBeenCalled();
  });

  it("builds a snapshot with normalized agents and hooks flag", async () => {
    const store = await onlineStore();
    const snap = store.getSnapshot();
    expect(snap.connection).toBe("online");
    expect(snap.hooksEnabled).toBe(true);
    expect(snap.agents.map((a) => a.id)).toEqual(["p1", "p2", "p3"]);
    expect(snap.counts).toMatchObject({ working: 1, waiting: 1, idle: 1 });
  });

  it("selects the first agent by default and steps with wrap-around", async () => {
    const store = await onlineStore();
    expect(store.getSelectedAgent()?.id).toBe("p1");
    expect(store.stepAgent(1)?.id).toBe("p2");
    expect(store.stepAgent(1)?.id).toBe("p3");
    expect(store.stepAgent(1)?.id).toBe("p1");
    expect(store.stepAgent(-1)?.id).toBe("p3");
  });

  it("selecting an agent also selects its worktree", async () => {
    const store = await onlineStore();
    store.selectAgentId("p3");
    expect(store.getSelectedAgent()?.id).toBe("p3");
    expect(store.getSelectedWorktree()?.path).toBe("/b");
  });

  it("steps worktrees independently", async () => {
    const store = await onlineStore();
    expect(store.getSelectedWorktree()?.path).toBe("/a");
    expect(store.stepWorktree(1)?.path).toBe("/b");
    expect(store.stepWorktree(1)?.path).toBe("/a");
  });

  it("returns the highest-priority needs-input agent", async () => {
    const store = await onlineStore();
    expect(store.getNeedsInputAgent()?.id).toBe("p2");
  });

  it("keeps selection valid across refreshes that drop the selected agent", async () => {
    const store = await onlineStore();
    store.selectAgentId("p3");
    mockWorktreePs.mockResolvedValue([
      wt("/a", [{ paneKey: "p1", state: "working", agentType: "claude" }])
    ]);
    await store.refresh();
    expect(store.getSelectedAgent()?.id).toBe("p1");
  });

  it("clamps the poll interval", () => {
    const store = new OrcaStore();
    store.updateSettings({ pollSeconds: 99 });
    expect(store.getSettings().pollSeconds).toBe(10);
    store.updateSettings({ pollSeconds: 0 });
    expect(store.getSettings().pollSeconds).toBe(2);
  });
});
