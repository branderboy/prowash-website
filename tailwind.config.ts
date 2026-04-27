import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: "#0b1f3a", 50: "#e6ebf2", 600: "#13315c", 700: "#0b1f3a", 900: "#050d1d" },
        orange: { DEFAULT: "#ff6a13", 500: "#ff6a13", 600: "#e85d0c" },
        cream: { DEFAULT: "#fdf6ec", 100: "#fdf6ec", 200: "#f6ead4" },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(11,31,58,.06), 0 4px 12px rgba(11,31,58,.06)",
      },
    },
  },
  plugins: [],
};

export default config;
