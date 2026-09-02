import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { getStatus, worktreePs, agentHooksStatus } from "../src/orca/api.js";
import type { OrcaWorktreeSummary } from "../src/orca/types.js";
import { OrcaStore } from "../src/state/store.js";

// vitest hoists vi.mock above the imports above, so this still mocks the API.
vi.mock("../src/orca/api.js", () => ({
  agentHooksStatus: vi.fn(),
  getStatus: vi.fn(),
  worktreePs: vi.fn(),
}));

const mockGetStatus = vi.mocked(getStatus);
const mockWorktreePs = vi.mocked(worktreePs);
const mockHooks = vi.mocked(agentHooksStatus);

const wt = (
  path: string,
  agents: OrcaWorktreeSummary["agents"]
): OrcaWorktreeSummary => ({
  agents,
  branch: path.replace("/", ""),
  hasAttachedPty: agents.length > 0,
  liveTerminalCount: agents.length,
  path,
  repo: "myrepo",
  repoId: "repo",
  status: "working",
  worktreeId: `repo::${path}`,
});

const onlineStore = async (): Promise<OrcaStore> => {
  mockGetStatus.mockResolvedValue({ connection: "online", raw: undefined });
  mockHooks.mockResolvedValue({
    appliedBy: "runtime",
    enabled: true,
    settingsPath: "",
    statuses: [],
  });
  mockWorktreePs.mockResolvedValue([
    wt("/a", [
      { agentType: "claude", paneKey: "p1", state: "working" },
      { agentType: "codex", paneKey: "p2", state: "waiting" },
    ]),
    wt("/b", [{ agentType: "claude", paneKey: "p3", state: "idle" }]),
  ]);
  const store = new OrcaStore();
  await store.refresh();
  return store;
};

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
    expect(snap.counts).toMatchObject({ idle: 1, waiting: 1, working: 1 });
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
      wt("/a", [{ agentType: "claude", paneKey: "p1", state: "working" }]),
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
