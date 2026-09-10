/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    container: {
      center: true,
      padding: '1rem',
    },
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        critical: 'var(--critical)',
        high: 'var(--high)',
        medium: 'var(--medium)',
        informational: 'var(--informational)',
        acknowledged: 'var(--acknowledged)',
        // Aviation-specific
        cockpit: {
          green: 'var(--cockpit-green)',
          amber: 'var(--cockpit-amber)',
          red: 'var(--cockpit-red)',
          blue: 'var(--cockpit-blue)',
        },
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
        sm: 'calc(var(--radius) - 2px)',
        md: 'var(--radius)',
        lg: 'calc(var(--radius) + 4px)',
        xl: 'calc(var(--radius) + 8px)',
        '2xl': 'calc(var(--radius) + 16px)',
      },
      fontFamily: {
        sans: ['var(--font-plus-jakarta-sans)', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'monospace'],
        avionics: ["'Share Tech Mono'", 'monospace'],
        orbitron: ["'Orbitron'", "'Share Tech Mono'", 'monospace'],
        rajdhani: ["'Rajdhani'", "'Share Tech Mono'", 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      boxShadow: {
        instrument: '0 0 12px rgba(255, 184, 0, 0.15), 0 0 1px rgba(255, 184, 0, 0.4)',
        'instrument-red': '0 0 12px rgba(255, 45, 45, 0.2), 0 0 1px rgba(255, 45, 45, 0.5)',
        'instrument-green': '0 0 12px rgba(0, 212, 106, 0.15), 0 0 1px rgba(0, 212, 106, 0.4)',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};