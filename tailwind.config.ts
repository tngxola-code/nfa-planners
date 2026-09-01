import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // NFA palette: navy / slate, low saturation (console styling lands in feat/003-console-shell)
        nfa: {
          navy: "#1e2a3a",
          slate: "#475569",
        },
      },
    },
  },
  plugins: [],
};

export default config;
