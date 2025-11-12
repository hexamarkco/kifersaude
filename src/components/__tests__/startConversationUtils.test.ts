import assert from 'node:assert/strict';
import {
  collectCrmLeadsWithoutContacts,
  resolveStartConversationSelection,
  type LeadPreview,
} from '../startConversationHelpers';
import type { ZAPIContact } from '../../lib/zapiService';

const leads: LeadPreview[] = [
  {
    id: 'lead-1',
    nome_completo: 'CRM Only Lead',
    telefone: '11988887777',
    status: 'Novo',
    responsavel: 'Ana',
    observacoes: null,
  },
  {
    id: 'lead-2',
    nome_completo: 'Already Synced Lead',
    telefone: '+55 11 98888-0000',
    status: 'Em atendimento',
    responsavel: 'Bruno',
    observacoes: null,
  },
  {
    id: 'lead-3',
    nome_completo: 'Duplicate Phone Lead',
    telefone: '5511988887777',
    status: 'Novo',
    responsavel: 'Ana',
    observacoes: null,
  },
];

const contacts: ZAPIContact[] = [
  {
    phone: '+55 (11) 98888-0000',
    name: 'WhatsApp Contact',
    short: null,
    vname: null,
    notify: null,
  },
];

const crmOnlyLeads = collectCrmLeadsWithoutContacts(leads, contacts);

assert.strictEqual(crmOnlyLeads.length, 1);
assert.strictEqual(crmOnlyLeads[0]?.id, 'lead-1');

const selectedLead: LeadPreview = {
  id: 'lead-1',
  nome_completo: 'CRM Only Lead',
  telefone: '11988887777',
  status: 'Novo',
  responsavel: 'Ana',
  observacoes: null,
};

const leadsMap = new Map<string, LeadPreview>([[selectedLead.id, selectedLead]]);
const leadsByPhoneMap = new Map<string, LeadPreview>([['5511988887777', selectedLead]]);

const selectionResult = resolveStartConversationSelection({
  phone: '11 98888-7777',
  selectedName: null,
  contacts: [],
  leadsByPhoneMap,
  leadsMap,
  selectedLeadId: selectedLead.id,
});

assert.notStrictEqual(selectionResult, null);
assert.strictEqual(selectionResult?.normalizedPhone, '5511988887777');
assert.strictEqual(selectionResult?.matchedLead?.id, selectedLead.id);
assert.strictEqual(selectionResult?.displayName, selectedLead.nome_completo);

console.log('startConversation utils tests passed');
