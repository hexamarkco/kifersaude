/** Prevents duplicate mutations for the same UI entity while allowing other entities to proceed. */
export class KeyedActionLock {
  private readonly lockedKeys = new Set<string>();

  tryAcquire(key: string) {
    if (this.lockedKeys.has(key)) {
      return false;
    }

    this.lockedKeys.add(key);
    return true;
  }

  release(key: string) {
    this.lockedKeys.delete(key);
  }
}
