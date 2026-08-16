import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  // "class" strategy: dark mode is enabled by adding the `dark` class to <html>
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f4ff",
          100: "#dbe4ff",
          300: "#97acf8",
          400: "#748ffc",
          500: "#4c6ef5",
          600: "#4263eb",
          700: "#3b5bdb",
          900: "#1c3faa",
        },
        // Semantic palette — values come from CSS variables defined in index.css.
        // Components use vs-* classes; the variables flip between light and dark.
        vs: {
          bg:             "rgb(var(--vs-bg) / <alpha-value>)",
          surface:        "rgb(var(--vs-surface) / <alpha-value>)",
          raised:         "rgb(var(--vs-raised) / <alpha-value>)",
          border:         "rgb(var(--vs-border) / <alpha-value>)",
          "border-light": "rgb(var(--vs-border-light) / <alpha-value>)",
          text:           "rgb(var(--vs-text) / <alpha-value>)",
          muted:          "rgb(var(--vs-muted) / <alpha-value>)",
          faint:          "rgb(var(--vs-faint) / <alpha-value>)",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
