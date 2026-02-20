/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary - Warm Amber/Gold representing trust and prosperity
        amber: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
          800: '#92400E',
          900: '#78350F',
        },
        // Secondary - Terracotta representing community and earth
        terra: {
          50: '#FDF2F0',
          100: '#FCE7E4',
          200: '#F9CFC8',
          300: '#F4A999',
          400: '#EB7D68',
          500: '#D95D44',
          600: '#C4402B',
          700: '#A33424',
          800: '#872D22',
          900: '#712922',
        },
        // Accent - Forest Green representing growth and financial wellness
        forest: {
          50: '#F0FDF4',
          100: '#DCFCE7',
          200: '#BBF7D0',
          300: '#86EFAC',
          400: '#4ADE80',
          500: '#22C55E',
          600: '#16A34A',
          700: '#15803D',
          800: '#166534',
          900: '#14532D',
        },
        // Warm neutrals for backgrounds
        cream: {
          50: '#FEFDFB',
          100: '#FCF9F3',
          200: '#F9F3E7',
          300: '#F3E8D4',
          400: '#E8D5B5',
          500: '#D9BE92',
          600: '#C4A06B',
          700: '#A67F4D',
          800: '#8B6840',
          900: '#735637',
        },
        // Deep contrast color for text and important elements
        midnight: {
          50: '#F7F6F5',
          100: '#EFECEA',
          200: '#DDD6D1',
          300: '#C7BBB3',
          400: '#A69689',
          500: '#8A7768',
          600: '#766557',
          700: '#615248',
          800: '#52463F',
          900: '#2C241F',
          950: '#1A1613',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      backgroundImage: {
        // Subtle organic pattern inspired by African kente cloth
        'pattern-kente': `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23D97706' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        // Circles pattern representing the rotating savings concept
        'pattern-circles': `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='50' cy='50' r='40' fill='none' stroke='%23D97706' stroke-opacity='0.08' stroke-width='1'/%3E%3Ccircle cx='50' cy='50' r='25' fill='none' stroke='%23166534' stroke-opacity='0.06' stroke-width='1'/%3E%3Ccircle cx='50' cy='50' r='10' fill='none' stroke='%23D95D44' stroke-opacity='0.05' stroke-width='1'/%3E%3C/svg%3E")`,
        // Gradient for hero sections
        'hero-gradient': 'linear-gradient(135deg, #FEFDFB 0%, #FCF9F3 50%, #F9F3E7 100%)',
        // Warm radial glow
        'warm-glow': 'radial-gradient(ellipse at center, rgba(251, 191, 36, 0.15) 0%, transparent 70%)',
      },
      boxShadow: {
        'warm': '0 4px 6px -1px rgba(146, 64, 14, 0.1), 0 2px 4px -1px rgba(146, 64, 14, 0.06)',
        'warm-lg': '0 10px 15px -3px rgba(146, 64, 14, 0.1), 0 4px 6px -2px rgba(146, 64, 14, 0.05)',
        'warm-xl': '0 20px 25px -5px rgba(146, 64, 14, 0.1), 0 10px 10px -5px rgba(146, 64, 14, 0.04)',
        'inner-warm': 'inset 0 2px 4px 0 rgba(146, 64, 14, 0.06)',
        'glow-amber': '0 0 20px rgba(251, 191, 36, 0.4)',
        'glow-forest': '0 0 20px rgba(22, 163, 74, 0.3)',
      },
      borderRadius: {
        'organic': '60% 40% 30% 70% / 60% 30% 70% 40%',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 20s linear infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'bounce-subtle': 'bounce-subtle 2s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'bounce-subtle': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
      },
    },
  },
  plugins: [],
}
