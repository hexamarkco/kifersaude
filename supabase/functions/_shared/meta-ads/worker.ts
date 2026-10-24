import { buildConversion, canSend, mapGraphLead, MetaError, retryDelay,
  type CapiApproval, type Conversion, type ImportedLead, type MetaConfig, type Receipt } from './domain.ts';

export type WorkerDependencies = {
  config: () => Promise<MetaConfig>;
  claimInbound: () => Promise<Receipt | null>;
  claimOutbound: () => Promise<Conversion | null>;
  retrieve: (id: string) => Promise<unknown>;
  importLead: (receipt: Receipt, lead: ImportedLead) => Promise<void>;
  validateOutbound: (event: Conversion) => Promise<boolean>;
  send: (dataset: string, event: ReturnType<typeof buildConversion>) => Promise<void>;
  finish: (direction: 'inbound' | 'outbound', id: string, lock: string,
    error: string | null, retrySeconds: number | null) => Promise<void>;
  approval: CapiApproval;
};
export async function runMetaWorker(deps: WorkerDependencies) {
  const config = await deps.config();
  const result = { imported: 0, sent: 0, failed: 0, capiEnabled: canSend(deps.approval) };
  // Small batches remain below the edge wall-clock limit with 15s Graph timeouts.
  for (let index = 0; config.enabled && index < 4; index++) {
    const receipt = await deps.claimInbound();
    if (!receipt) break;
    try {
      if (receipt.page_id !== config.pageId || receipt.form_id !== config.formId) throw new MetaError('ORIGIN_MISMATCH');
      const lead = mapGraphLead(await deps.retrieve(receipt.leadgen_id), receipt, config);
      await deps.importLead(receipt, lead);
      result.imported++;
    } catch (error) {
      const failure = error instanceof MetaError ? error : new MetaError('IMPORT_UNAVAILABLE', true);
      await deps.finish('inbound', receipt.leadgen_id, receipt.lock_token!, failure.code,
        failure.retryable && (receipt.attempts ?? 8) < 8 ? retryDelay(receipt.attempts ?? 1) : null);
      result.failed++;
    }
  }
  // Disabled delivery never claims an event, changes a lease or calls Graph CAPI.
  for (let index = 0; result.capiEnabled && index < 4; index++) {
    const event = await deps.claimOutbound();
    if (!event) break;
    try {
      const payload = buildConversion(event, deps.approval);
      if (!await deps.validateOutbound(event)) throw new MetaError('COMMERCIAL_SIGNAL_REVOKED');
      await deps.send(event.dataset_id, payload);
      await deps.finish('outbound', event.event_id, event.lock_token, null, null);
      result.sent++;
    } catch (error) {
      const failure = error instanceof MetaError ? error : new MetaError('DELIVERY_UNAVAILABLE', true);
      await deps.finish('outbound', event.event_id, event.lock_token, failure.code,
        failure.retryable && event.attempts < 8 ? retryDelay(event.attempts) : null);
      result.failed++;
    }
  }
  return result;
}
