import { DEFAULT_GENERAL_PREFERENCES } from '../../../src/features/config/general/shared/systemSettingsConfig';

const blockWrite = async () => ({ error: new Error('Escritas bloqueadas nesta prévia sintética.') });

export const configService = {
  getSystemSettings: async () => ({
    id: 'settings-demo',
    company_name: 'Kifer Saúde',
    ...DEFAULT_GENERAL_PREFERENCES,
    created_at: '2026-10-30T12:00:00.000Z',
    updated_at: '2026-10-30T12:00:00.000Z',
  }),
  updateSystemSettings: blockWrite,
};
