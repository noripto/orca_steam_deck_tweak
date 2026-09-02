import { logger } from "../logger.js";
import type { OrcaSnapshot } from "../orca/types.js";
import type { OrcaStore } from "./store.js";

export type SnapshotListener = (snapshot: OrcaSnapshot) => void;

export const signatureOf = (snapshot: OrcaSnapshot): string => {
  const agents = snapshot.agents
    .map((a) => `${a.id}:${a.state}:${a.label}`)
    .join("|");
  const worktrees = snapshot.worktrees
    .map((w) => `${w.worktreeId}:${w.state}:${w.unread}`)
    .join("|");
  return [
    snapshot.connection,
    snapshot.errorMessage ?? "",
    snapshot.hooksEnabled,
    agents,
    worktrees,
  ].join("~");
};

export class OrcaPoller {
  private readonly store: OrcaStore;
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private active = false;
  private listeners = new Set<SnapshotListener>();
  private lastSignature = "";

  constructor(store: OrcaStore) {
    this.store = store;
  }

  subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    listener(this.store.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  start(): void {
    if (this.active) {
      return;
    }
    this.active = true;
    this.runTick();
  }

  stop(): void {
    this.active = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  async refreshNow(): Promise<void> {
    try {
      await this.pollOnce();
    } finally {
      this.emit(this.store.getSnapshot());
      this.scheduleNext();
    }
  }

  private async pollOnce(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      await this.store.refresh();
      this.notifyIfChanged();
    } finally {
      this.running = false;
    }
  }

  /**
   * A failed poll must not stop the loop, so the next run is scheduled in a
   * `finally` block before the rejection propagates to {@link runTick}.
   */
  private async tick(): Promise<void> {
    try {
      await this.pollOnce();
    } finally {
      this.scheduleNext();
    }
  }

  /** Fire-and-forget entry point for `start()` and the timer callback. */
  private runTick(): void {
    // oxlint-disable-next-line eslint/no-void
    void this.tickSafely();
  }

  /**
   * `tick()` reschedules itself in a `finally`, so a rejection here is already
   * handled; catching it stops it surfacing as an unhandled promise.
   */
  private async tickSafely(): Promise<void> {
    try {
      await this.tick();
    } catch (error) {
      // Already rescheduled by tick()'s finally, so the loop keeps running;
      // logging is all that is left to do with this.
      logger.error("poll failed", error);
    }
  }

  private scheduleNext(): void {
    if (!this.active) {
      return;
    }
    if (this.timer) {
      clearTimeout(this.timer);
    }
    const ms = this.store.getSettings().pollSeconds * 1000;
    this.timer = setTimeout(() => {
      this.runTick();
    }, ms);
  }

  private notifyIfChanged(): void {
    const snapshot = this.store.getSnapshot();
    const signature = signatureOf(snapshot);
    if (signature === this.lastSignature) {
      return;
    }
    this.lastSignature = signature;
    this.reportConnection(snapshot);
    this.emit(snapshot);
  }

  /**
   * Logs why Orca is unreachable. Called only when the snapshot signature
   * changed, so a persistent outage produces one entry rather than one every
   * poll interval.
   */
  // oxlint-disable-next-line eslint/class-methods-use-this
  private reportConnection(snapshot: OrcaSnapshot): void {
    if (snapshot.connection === "online") {
      return;
    }
    const reason = snapshot.errorMessage ?? "no further detail";
    logger.warn(`Orca is ${snapshot.connection}: ${reason}`);
  }

  private emit(snapshot: OrcaSnapshot): void {
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (error) {
        // A misbehaving key must not stop others from updating, but it should
        // not vanish either.
        logger.error("snapshot listener failed", error);
      }
    }
  }
}
