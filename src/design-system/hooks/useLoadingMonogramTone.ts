import { useLayoutEffect, useRef } from 'react';
import { useDesignSystemAppearance } from '../appearanceContext';

type Rgb = [number, number, number];
type Rgba = [number, number, number, number];

/** Change lightness while preserving the background's hue and saturation. */
export function getLoadingMonogramTone(rgb: Rgb): string {
  const [r, g, b] = rgb.map(channel => channel / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  const hue = delta === 0 ? 0 : max === r
    ? ((g - b) / delta + 6) % 6 * 60
    : max === g ? ((b - r) / delta + 2) * 60 : ((r - g) / delta + 4) * 60;
  const toneLightness = lightness < 0.5 ? lightness + 0.16 : lightness - 0.22;
  return `hsl(${hue.toFixed(2)} ${(saturation * 100).toFixed(2)}% ${(toneLightness * 100).toFixed(2)}%)`;
}

function parseBackground(value: string): Rgba | null {
  if (value === 'transparent') return [0, 0, 0, 0];
  const match = value.match(/^(rgba?|color)\((.*)\)$/);
  if (!match) return null;
  const srgb = match[1] === 'color' && match[2].startsWith('srgb ');
  if (match[1] === 'color' && !srgb) return null;
  const channels = match[2].replace(/^srgb\s+/, '').split(/[\s,/]+/).map(Number);
  if (channels.length < 3 || channels.some(channel => !Number.isFinite(channel))) return null;
  const scale = srgb ? 255 : 1;
  return [channels[0] * scale, channels[1] * scale, channels[2] * scale, channels[3] ?? 1];
}

export function useLoadingMonogramTone(active: boolean) {
  const ref = useRef<SVGSVGElement>(null);
  const theme = useDesignSystemAppearance()?.theme;

  useLayoutEffect(() => {
    const monogram = ref.current;
    if (!active || !monogram) return;
    const background: Rgb = [0, 0, 0];
    let opacity = 0;
    let parent = monogram.parentElement;
    // Composite translucent containers over their ancestors, nearest surface first.
    while (parent && opacity < 1) {
      const color = parseBackground(window.getComputedStyle(parent).backgroundColor);
      if (color) {
        const contribution = color[3] * (1 - opacity);
        background[0] += color[0] * contribution;
        background[1] += color[1] * contribution;
        background[2] += color[2] * contribution;
        opacity += contribution;
      }
      parent = parent.parentElement;
    }
    // The browser canvas is white when every ancestor is transparent.
    const rgb: Rgb = [background[0] + 255 * (1 - opacity), background[1] + 255 * (1 - opacity), background[2] + 255 * (1 - opacity)];
    monogram.style.setProperty('--loading-monogram-color', getLoadingMonogramTone(rgb));
  }, [active, theme]);

  return ref;
}
