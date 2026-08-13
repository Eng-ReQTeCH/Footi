/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // --bg-* surfaces (night stadium base)
        pitch: {
          950: 'rgba(11, 34, 40, 0.82)', // inputs / secondary surfaces (--bg-800)
          900: 'rgba(6, 18, 24, 0.82)', // main cards (--bg-900, glassy)
          850: 'rgba(8, 26, 32, 0.82)', // elevated cards (--bg-850)
          800: 'rgba(8, 26, 32, 0.82)', // hover / active surfaces (--bg-850)
          700: '#16404A', // default borders (--border)
          bright: '#1D5963', // focus / highlighted borders (--border-bright)
        },
        // --brand-* (Primary #00E58B)
        emerald: {
          300: '#33F0B0',
          400: '#19F5A0',
          500: '#00E58B',
          600: '#00C878',
          700: '#009F63',
        },
        // --text-*
        slate: {
          50: '#F5FAF9',
          100: '#F5FAF9',
          200: '#D7E5E3',
          300: '#9FB6B3',
          400: '#6F8987',
          500: '#5A726F',
          600: '#4B6261',
          700: '#3A4D4C',
          800: '#23302F',
          900: '#16201F',
          950: '#0B1413',
        },
        // --warning (Judge mode / caution, #FFB020)
        amber: {
          300: '#FFC94D',
          400: '#FFB020',
          500: '#FFB020',
          600: '#E89B00',
        },
        // --danger (Incorrect / destructive, #FF4268)
        rose: {
          300: '#FF7A97',
          400: '#FF4268',
          500: '#FF4268',
          950: '#2E0D17',
        },
        // --info (#38BDF8)
        sky: {
          300: '#7DD3FC',
          500: '#38BDF8',
        },
        // semantic aliases per design tokens
        success: '#00E58B',
        warning: '#FFB020',
        danger: '#FF4268',
        info: '#38BDF8',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '18px',
        '2xl': '24px',
      },
      boxShadow: {
        card: '0 8px 32px rgba(0, 0, 0, 0.28)',
        'card-lg': '0 16px 48px rgba(0, 0, 0, 0.40)',
        brand: '0 0 24px rgba(0, 229, 139, 0.18)',
        'brand-hover': '0 0 28px rgba(0, 229, 139, 0.30)',
        warning: '0 0 24px rgba(255, 176, 32, 0.18)',
      },
      transitionDuration: {
        100: '100ms',
        160: '160ms',
        220: '220ms',
        350: '350ms',
        600: '600ms',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pop: {
          '0%': { opacity: '0', transform: 'scale(0.94)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
      },
      animation: {
        'fade-up': 'fade-up 350ms cubic-bezier(0.16, 1, 0.3, 1)',
        pop: 'pop 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-soft': 'pulse-soft 1s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};