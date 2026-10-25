import defaultTheme from 'tailwindcss/defaultTheme.js';

// Layout utilities consume the same spacing unit and radii as the components.
// Fractions, intrinsic dimensions and data-driven measurements remain layout concerns.
const spacing = Object.fromEntries(Object.keys(defaultTheme.spacing).map((key) => [
  key,
  key === 'px' ? 'var(--border-width, 1px)' : key === '0' ? '0px' : `calc(var(--space-unit, 0.25rem) * ${key})`,
]));

export default {
  theme: {
    spacing,
    extend: {
      fontFamily: { sans: ['var(--font-sans)', 'sans-serif'], serif: ['var(--font-display)', 'serif'] },
      borderRadius: {
        DEFAULT: 'var(--radius-control)', sm: 'var(--radius-sm)', md: 'var(--radius-control)',
        lg: 'var(--radius-panel)', xl: 'var(--radius-dialog)', '2xl': 'var(--radius-dialog)',
        '3xl': 'var(--radius-dialog)', full: 'var(--radius-full)',
      },
      zIndex: { '60': '60', '70': '70' },
    },
  },
};
