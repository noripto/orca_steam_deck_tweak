import type { OrcaSnapshot } from "../orca/types.js";
import type { OrcaStore } from "./store.js";

export type SnapshotListener = (snapshot: OrcaSnapshot) => void;

export class OrcaPoller {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private active = false;
  private listeners = new Set<SnapshotListener>();
  private lastSignature = "";

  constructor(private readonly store: OrcaStore) {}

  subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    listener(this.store.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  start(): void {
    if (this.active) return;
    this.active = true;
    void this.tick();
  }

  stop(): void {
    this.active = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  async refreshNow(): Promise<void> {
    await this.pollOnce();
    this.emit(this.store.getSnapshot());
    this.scheduleNext();
  }

  private async pollOnce(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.store.refresh();
      this.notifyIfChanged();
    } finally {
      this.running = false;
    }
  }

  private async tick(): Promise<void> {
    await this.pollOnce();
    this.scheduleNext();
  }

  private scheduleNext(): void {
    if (!this.active) return;
    if (this.timer) clearTimeout(this.timer);
    const ms = this.store.getSettings().pollSeconds * 1000;
    this.timer = setTimeout(() => void this.tick(), ms);
  }

  private notifyIfChanged(): void {
    const snapshot = this.store.getSnapshot();
    const signature = signatureOf(snapshot);
    if (signature === this.lastSignature) return;
    this.lastSignature = signature;
    this.emit(snapshot);
  }

  private emit(snapshot: OrcaSnapshot): void {
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch {
        // A misbehaving key must not stop others from updating.
      }
    }
  }
}

export function signatureOf(snapshot: OrcaSnapshot): string {
  const agents = snapshot.agents.map((a) => `${a.id}:${a.state}:${a.label}`).join("|");
  const worktrees = snapshot.worktrees.map((w) => `${w.worktreeId}:${w.state}:${w.unread}`).join("|");
  return [snapshot.connection, snapshot.hooksEnabled, agents, worktrees].join("~");
}
