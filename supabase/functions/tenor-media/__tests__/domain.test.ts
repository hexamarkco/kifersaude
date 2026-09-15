import { describe, expect, it } from 'vitest';
import { isTrustedTenorMediaUrl, mapTenorResult, mapTenorResults } from '../domain';

describe('Tenor media mapping', () => {
  it('accepts HTTPS media hosted by Tenor and rejects untrusted URLs', () => {
    expect(isTrustedTenorMediaUrl('https://media.tenor.com/asset.gif')).toBe(true);
    expect(isTrustedTenorMediaUrl('https://tenor.com/asset')).toBe(true);
    expect(isTrustedTenorMediaUrl('https://tenor.com.attacker.example/asset')).toBe(false);
    expect(isTrustedTenorMediaUrl('http://media.tenor.com/asset.gif')).toBe(false);
  });

  it('maps GIFs to validated preview and send URLs', () => {
    const item = mapTenorResult({
      id: 'gif-1',
      title: 'Funny GIF',
      media_formats: {
        tinygifpreview: { url: 'https://media.tenor.com/preview.gif' },
        mp4: { url: 'https://media.tenor.com/send.mp4' },
      },
    }, 'gif');

    expect(item).toEqual({
      id: 'gif-1',
      title: 'Funny GIF',
      previewUrl: 'https://media.tenor.com/preview.gif',
      sendUrl: 'https://media.tenor.com/send.mp4',
      mimeType: 'video/mp4',
      sendKind: 'video',
    });
  });

  it('drops results with an untrusted asset URL and caps the list', () => {
    const untrusted = {
      id: 'bad',
      media_formats: {
        tinygifpreview: { url: 'https://media.tenor.com/preview.gif' },
        mp4: { url: 'https://attacker.example/send.mp4' },
      },
    };
    expect(mapTenorResult(untrusted, 'gif')).toBeNull();
    expect(mapTenorResults([untrusted], 'gif')).toEqual([]);
  });
});
