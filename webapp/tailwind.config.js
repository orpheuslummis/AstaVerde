const colors = require('tailwindcss/colors');

module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "rgb(88, 172, 96)",
          light: "rgb(120, 200, 128)",
          dark: "rgb(70, 140, 78)",
        },
        secondary: {
          DEFAULT: "rgb(61, 155, 233)",
          light: "rgb(100, 180, 255)",
          dark: "rgb(40, 120, 200)",
        },
        gray: {
          100: colors.slate[100],
          700: colors.slate[700],
          800: colors.slate[800],
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.75rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
      },
    },
  },
  plugins: [],
};