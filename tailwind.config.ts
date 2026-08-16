import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f4ff",
          100: "#dbe4ff",
          500: "#4c6ef5",
          600: "#4263eb",
          700: "#3b5bdb",
          900: "#1c3faa",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
