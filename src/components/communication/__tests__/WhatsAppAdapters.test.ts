import { test } from 'vitest';
import assert from 'node:assert/strict';

import LegacyWhatsAppTab from '../WhatsAppTab';
import { MessageInput as LegacyMessageInput } from '../MessageInput';
import { MessageBubble as LegacyMessageBubble } from '../MessageBubble';

import FeatureWhatsAppTab from '../../../features/whatsapp/inbox/WhatsAppInboxScreen';
import { MessageInput as FeatureMessageInput } from '../../../features/whatsapp/composer/WhatsAppComposer';
import { MessageBubble as FeatureMessageBubble } from '../../../features/whatsapp/inbox/components/MessageBubble';

test('legacy whatsapp adapters forward the feature exports', () => {
  assert.equal(LegacyWhatsAppTab, FeatureWhatsAppTab);
  assert.equal(LegacyMessageInput, FeatureMessageInput);
  assert.equal(LegacyMessageBubble, FeatureMessageBubble);
});
