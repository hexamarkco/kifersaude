/**
 * Compatibility entrypoint while consumers migrate to feature public APIs and
 * the infrastructure boundary. New code must not add imports from this file.
 */
export * from '../infrastructure/supabase';
export type * from '../features/activity';
export type * from '../features/config';
export type * from '../features/contracts';
export type * from '../features/leads';
export type * from '../features/public-content';
export type * from '../features/reminders';
export type * from '../features/communication/whatsapp';
