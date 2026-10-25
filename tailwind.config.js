import designSystem from './src/design-system/tailwind.preset.js';

/** @type {import('tailwindcss').Config} */
export default {
  presets: [designSystem],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  plugins: [],
};
