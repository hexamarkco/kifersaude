export class LeadStatusMutationLock {
  private nextToken = 0;
  private readonly activeMutations = new Map<string, number>();

  tryAcquire(leadId: string): number | null {
    if (this.activeMutations.has(leadId)) {
      return null;
    }

    const token = ++this.nextToken;
    this.activeMutations.set(leadId, token);
    return token;
  }

  isCurrent(leadId: string, token: number): boolean {
    return this.activeMutations.get(leadId) === token;
  }

  release(leadId: string, token: number): void {
    if (this.isCurrent(leadId, token)) {
      this.activeMutations.delete(leadId);
    }
  }
}
