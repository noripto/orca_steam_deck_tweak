import { agentHooksStatus, getStatus, worktreePs } from "../orca/api.js";
import type { OrcaCliOptions } from "../orca/cli.js";
import { countByState, normalizeWorktrees } from "../orca/normalize.js";
import type { NormalizedAgent, NormalizedWorktree, OrcaSnapshot } from "../orca/types.js";

export interface OrcaSettings {
  cliPath: string;
  pollSeconds: number;
}

export const DEFAULT_SETTINGS: OrcaSettings = { cliPath: "auto", pollSeconds: 3 };

export function cliOptions(settings: OrcaSettings): OrcaCliOptions {
  return { cliPath: settings.cliPath };
}

function emptySnapshot(): OrcaSnapshot {
  return {
    connection: "offline",
    agents: [],
    worktrees: [],
    counts: { working: 0, waiting: 0, done: 0, idle: 0, unknown: 0 },
    hooksEnabled: false,
    updatedAt: 0,
  };
}

export class OrcaStore {
  private snapshot: OrcaSnapshot = emptySnapshot();
  private settings: OrcaSettings = { ...DEFAULT_SETTINGS };
  private selectedAgentId: string | null = null;
  private selectedWorktreeId: string | null = null;

  getSnapshot(): OrcaSnapshot {
    return this.snapshot;
  }

  getSettings(): OrcaSettings {
    return this.settings;
  }

  updateSettings(patch: Partial<OrcaSettings>): void {
    this.settings = { ...this.settings, ...patch };
    if (!Number.isFinite(this.settings.pollSeconds))
      this.settings.pollSeconds = DEFAULT_SETTINGS.pollSeconds;
    this.settings.pollSeconds = Math.min(10, Math.max(2, this.settings.pollSeconds));
    if (!this.settings.cliPath) this.settings.cliPath = "auto";
  }

  async refresh(): Promise<OrcaSnapshot> {
    const opts = cliOptions(this.settings);
    const status = await getStatus(opts);

    if (status.connection !== "online") {
      this.snapshot = { ...emptySnapshot(), connection: status.connection, updatedAt: Date.now() };
      this.reconcileSelection();
      return this.snapshot;
    }

    let agents: NormalizedAgent[] = [];
    let worktrees: NormalizedWorktree[] = [];
    let hooksEnabled = false;
    try {
      const [summaries, hooks] = await Promise.all([worktreePs(opts), agentHooksStatus(opts)]);
      const normalized = normalizeWorktrees(summaries);
      agents = normalized.agents;
      worktrees = normalized.worktrees;
      hooksEnabled = hooks?.enabled ?? false;
    } catch {
      this.snapshot = { ...emptySnapshot(), connection: "error", updatedAt: Date.now() };
      this.reconcileSelection();
      return this.snapshot;
    }

    this.snapshot = {
      connection: "online",
      agents,
      worktrees,
      counts: countByState(agents),
      hooksEnabled,
      updatedAt: Date.now(),
    };
    this.reconcileSelection();
    return this.snapshot;
  }

  getSelectedAgent(): NormalizedAgent | null {
    const { agents } = this.snapshot;
    if (agents.length === 0) return null;
    return agents.find((a) => a.id === this.selectedAgentId) ?? agents[0]!;
  }

  getSelectedWorktree(): NormalizedWorktree | null {
    const { worktrees } = this.snapshot;
    if (worktrees.length === 0) return null;
    return worktrees.find((w) => w.worktreeId === this.selectedWorktreeId) ?? worktrees[0]!;
  }

  selectAgentId(id: string): void {
    this.selectedAgentId = id;
    const agent = this.snapshot.agents.find((a) => a.id === id);
    if (agent) this.selectedWorktreeId = agent.worktreeId;
  }

  selectWorktreeId(id: string): void {
    this.selectedWorktreeId = id;
  }

  stepAgent(delta: number): NormalizedAgent | null {
    return this.step(
      this.snapshot.agents,
      (a) => a.id,
      this.selectedAgentId,
      delta,
      (a) => this.selectAgentId(a.id),
    );
  }

  stepWorktree(delta: number): NormalizedWorktree | null {
    return this.step(
      this.snapshot.worktrees,
      (w) => w.worktreeId,
      this.selectedWorktreeId,
      delta,
      (w) => this.selectWorktreeId(w.worktreeId),
    );
  }

  private step<T>(
    items: T[],
    idOf: (t: T) => string,
    currentId: string | null,
    delta: number,
    apply: (t: T) => void,
  ): T | null {
    if (items.length === 0) return null;
    const currentIndex = items.findIndex((t) => idOf(t) === currentId);
    const base = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = (base + delta + items.length) % items.length;
    const next = items[nextIndex]!;
    apply(next);
    return next;
  }

  getNeedsInputAgent(): NormalizedAgent | null {
    const waiting = this.snapshot.agents.filter((a) => a.state === "waiting");
    return waiting[0] ?? null;
  }

  private reconcileSelection(): void {
    if (this.selectedAgentId && !this.snapshot.agents.some((a) => a.id === this.selectedAgentId)) {
      this.selectedAgentId = this.snapshot.agents[0]?.id ?? null;
    }
    if (
      this.selectedWorktreeId &&
      !this.snapshot.worktrees.some((w) => w.worktreeId === this.selectedWorktreeId)
    ) {
      this.selectedWorktreeId = this.snapshot.worktrees[0]?.worktreeId ?? null;
    }
  }
}
