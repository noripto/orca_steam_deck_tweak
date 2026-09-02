import { agentHooksStatus, getStatus, worktreePs } from "../orca/api.js";
import type { OrcaCliOptions } from "../orca/cli.js";
import { countByState, normalizeWorktrees } from "../orca/normalize.js";
import type {
  NormalizedAgent,
  NormalizedWorktree,
  OrcaSnapshot,
} from "../orca/types.js";

export interface OrcaSettings {
  cliPath: string;
  pollSeconds: number;
}

export const DEFAULT_SETTINGS: OrcaSettings = {
  cliPath: "auto",
  pollSeconds: 3,
};

export const cliOptions = (settings: OrcaSettings): OrcaCliOptions => ({
  cliPath: settings.cliPath,
});

const emptySnapshot = (): OrcaSnapshot => ({
  agents: [],
  connection: "offline",
  counts: { done: 0, idle: 0, unknown: 0, waiting: 0, working: 0 },
  hooksEnabled: false,
  updatedAt: 0,
  worktrees: [],
});

/** Move a selection `delta` places through `items`, wrapping at both ends. */
const stepSelection = <T>(
  items: T[],
  idOf: (t: T) => string,
  currentId: string | null,
  delta: number,
  apply: (t: T) => void
): T | null => {
  const currentIndex = items.findIndex((t) => idOf(t) === currentId);
  const base = Math.max(currentIndex, 0);
  const nextIndex = (base + delta + items.length) % items.length;
  const next = items[nextIndex];
  if (!next) {
    return null;
  }
  apply(next);
  return next;
};

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
    if (!Number.isFinite(this.settings.pollSeconds)) {
      this.settings.pollSeconds = DEFAULT_SETTINGS.pollSeconds;
    }
    this.settings.pollSeconds = Math.min(
      10,
      Math.max(2, this.settings.pollSeconds)
    );
    if (!this.settings.cliPath) {
      this.settings.cliPath = "auto";
    }
  }

  async refresh(): Promise<OrcaSnapshot> {
    const opts = cliOptions(this.settings);
    const status = await getStatus(opts);

    if (status.connection !== "online") {
      this.snapshot = {
        ...emptySnapshot(),
        connection: status.connection,
        errorMessage: status.errorMessage,
        updatedAt: Date.now(),
      };
      this.reconcileSelection();
      return this.snapshot;
    }

    let agents: NormalizedAgent[] = [];
    let worktrees: NormalizedWorktree[] = [];
    let hooksEnabled = false;
    try {
      const [summaries, hooks] = await Promise.all([
        worktreePs(opts),
        agentHooksStatus(opts),
      ]);
      ({ agents, worktrees } = normalizeWorktrees(summaries));
      hooksEnabled = hooks?.enabled ?? false;
    } catch (error) {
      // Listing worktrees failed even though `orca status` reported online.
      // Keep the reason: the keys only have room for "ERROR", and without it
      // the cause is gone for good.
      this.snapshot = {
        ...emptySnapshot(),
        connection: "error",
        errorMessage: error instanceof Error ? error.message : String(error),
        updatedAt: Date.now(),
      };
      this.reconcileSelection();
      return this.snapshot;
    }

    this.snapshot = {
      agents,
      connection: "online",
      counts: countByState(agents),
      hooksEnabled,
      updatedAt: Date.now(),
      worktrees,
    };
    this.reconcileSelection();
    return this.snapshot;
  }

  getSelectedAgent(): NormalizedAgent | null {
    const { agents } = this.snapshot;
    const [first] = agents;
    return agents.find((a) => a.id === this.selectedAgentId) ?? first ?? null;
  }

  getSelectedWorktree(): NormalizedWorktree | null {
    const { worktrees } = this.snapshot;
    const [first] = worktrees;
    return (
      worktrees.find((w) => w.worktreeId === this.selectedWorktreeId) ??
      first ??
      null
    );
  }

  selectAgentId(id: string): void {
    this.selectedAgentId = id;
    const agent = this.snapshot.agents.find((a) => a.id === id);
    if (agent) {
      this.selectedWorktreeId = agent.worktreeId;
    }
  }

  selectWorktreeId(id: string): void {
    this.selectedWorktreeId = id;
  }

  stepAgent(delta: number): NormalizedAgent | null {
    return stepSelection(
      this.snapshot.agents,
      (a) => a.id,
      this.selectedAgentId,
      delta,
      (a) => this.selectAgentId(a.id)
    );
  }

  stepWorktree(delta: number): NormalizedWorktree | null {
    return stepSelection(
      this.snapshot.worktrees,
      (w) => w.worktreeId,
      this.selectedWorktreeId,
      delta,
      (w) => this.selectWorktreeId(w.worktreeId)
    );
  }

  getNeedsInputAgent(): NormalizedAgent | null {
    return this.snapshot.agents.find((a) => a.state === "waiting") ?? null;
  }

  private reconcileSelection(): void {
    if (
      this.selectedAgentId &&
      !this.snapshot.agents.some((a) => a.id === this.selectedAgentId)
    ) {
      this.selectedAgentId = this.snapshot.agents[0]?.id ?? null;
    }
    if (
      this.selectedWorktreeId &&
      !this.snapshot.worktrees.some(
        (w) => w.worktreeId === this.selectedWorktreeId
      )
    ) {
      this.selectedWorktreeId = this.snapshot.worktrees[0]?.worktreeId ?? null;
    }
  }
}
