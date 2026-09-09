import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        nfa: {
          navy: '#1B2A4A',
          green: '#157A52',
          orange: '#E8963A',
          blue: '#1E5A96'
        }
      }
    }
  },
  plugins: []
};

export default config;
