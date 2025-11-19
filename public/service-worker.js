const CACHE_NAME = 'kifersaude-shell-v1';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest'];
const FALLBACK_ROUTE = '/painel';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => Promise.resolve())
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((oldKey) => caches.delete(oldKey))
        )
      )
      .catch(() => Promise.resolve())
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).catch(() => caches.match('/index.html')))
  );
});

function parsePushData(event) {
  if (!event.data) {
    return {};
  }

  try {
    return event.data.json();
  } catch (_error) {
    return { body: event.data.text() };
  }
}

function buildNotificationOptions(payload) {
  const notificationType = payload.type;
  const actions = [];

  if (notificationType === 'lead') {
    actions.push({ action: 'view-lead', title: 'Ver Lead' });
  } else if (notificationType === 'reminder') {
    actions.push({ action: 'view-reminders', title: 'Ver Lembretes' });
  }

  return {
    body: payload.body ?? '',
    icon: payload.icon ?? '/image.png',
    badge: payload.badge ?? '/image.png',
    tag: payload.tag ?? `${notificationType ?? 'kifersaude'}-${payload.id ?? ''}`,
    data: payload,
    actions,
    renotify: true,
  };
}

async function broadcastPayloadToClients(payload) {
  const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  clientList.forEach((client) => {
    client.postMessage({ source: 'push-service', payload });
  });
}

self.addEventListener('push', (event) => {
  const payload = parsePushData(event);
  const title = payload.title ?? 'Kifer Saúde';

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, buildNotificationOptions(payload));
      await broadcastPayloadToClients(payload);
    })()
  );
});

async function openPanel(linkFromPayload) {
  const targetUrl = linkFromPayload || FALLBACK_ROUTE;
  const absoluteUrl = new URL(targetUrl, self.location.origin).href;
  const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

  for (const client of clientList) {
    const clientUrl = new URL(client.url);
    if (clientUrl.pathname.startsWith('/painel')) {
      await client.focus();
      return client;
    }
  }

  return self.clients.openWindow(absoluteUrl);
}

async function acknowledgeNotification(payload, action) {
  const ackUrl = payload?.meta?.ackUrl;
  const subscriptionId = payload?.meta?.subscriptionId;

  if (!ackUrl || !subscriptionId || !payload?.id || !payload?.type) {
    return;
  }

  try {
    await fetch(ackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'ack',
        subscriptionId,
        itemId: payload.id,
        itemType: payload.type,
        source: action ?? 'click',
      }),
      keepalive: true,
    });
  } catch (error) {
    console.warn('Não foi possível confirmar leitura do push:', error);
  }
}

self.addEventListener('notificationclick', (event) => {
  const payload = event.notification?.data;
  event.notification?.close();

  event.waitUntil(
    (async () => {
      const client = await openPanel(payload?.link);
      if (client && payload) {
        client.postMessage({ source: 'push-service', payload, action: event.action || 'default-click' });
      }
      await acknowledgeNotification(payload, event.action);
    })()
  );
});
