import type { CommWhatsAppMessage } from './types';

export const getMessageLocationInfo = (message: CommWhatsAppMessage) => {
  const kind = message.message_type.trim().toLowerCase();
  if (kind !== 'location' && kind !== 'live_location') return null;

  const value = message.metadata.location;
  const location = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const readCoordinate = (value: unknown, limit: number) => {
    if (typeof value !== 'number' && typeof value !== 'string') return null;
    if (typeof value === 'string' && !value.trim()) return null;
    const coordinate = Number(value);
    return Number.isFinite(coordinate) && Math.abs(coordinate) <= limit ? coordinate : null;
  };
  const latitude = readCoordinate(location.latitude, 90);
  const longitude = readCoordinate(location.longitude, 180);
  const readText = (value: unknown) => typeof value === 'string' ? value.trim() || null : null;
  const hasCoordinates = latitude !== null && longitude !== null;
  const mapPreviewUrl = hasCoordinates
    ? `https://www.openstreetmap.org/export/embed.html?${new URLSearchParams({
      bbox: [
        Math.max(-180, longitude - 0.008),
        Math.max(-90, latitude - 0.005),
        Math.min(180, longitude + 0.008),
        Math.min(90, latitude + 0.005),
      ].join(','),
      layer: 'mapnik',
      marker: `${latitude},${longitude}`,
    })}`
    : null;

  return {
    live: kind === 'live_location',
    latitude,
    longitude,
    name: readText(location.name),
    address: readText(location.address),
    comment: readText(location.comment),
    mapPreviewUrl,
    mapUrl: latitude !== null && longitude !== null
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`
      : null,
  };
};
