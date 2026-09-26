/** Serializes asynchronous work per entity while allowing different entities to run in parallel. */
export class KeyedPromiseQueue {
  private readonly queues = new Map<string, Promise<void>>();

  enqueue(key: string, task: () => Promise<void>) {
    const previous = this.queues.get(key) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(task);
    const clearQueue = () => {
        if (this.queues.get(key) === next) {
          this.queues.delete(key);
        }
    };

    this.queues.set(key, next);
    void next.then(clearQueue, clearQueue);
    return next;
  }
}
