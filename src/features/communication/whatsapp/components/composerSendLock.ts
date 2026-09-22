/** Keeps an identical composer payload from entering the outgoing queue twice. */
export class ComposerSendLock {
  private readonly lockedSnapshotKeys = new Set<string>();

  tryAcquire(snapshotKey: string) {
    if (this.lockedSnapshotKeys.has(snapshotKey)) {
      return false;
    }

    this.lockedSnapshotKeys.add(snapshotKey);
    return true;
  }

  release(snapshotKey: string) {
    this.lockedSnapshotKeys.delete(snapshotKey);
  }
}
