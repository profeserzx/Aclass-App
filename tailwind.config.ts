import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0B0F19",
        surface: "#111528",
        accent: "#5B8DFF",
        accent2: "#7AF0C4",
        // Warm Trust landing page palette
        "warm-bg": "#FFFBF5",
        "warm-sand": "#F5F0EB",
        "warm-card": "#FFFFFF",
        "warm-green": "#006D5B",
        "warm-emerald": "#059669",
        "warm-ink": "#1A1A1A",
        "warm-muted": "#4A4A4A",
        "warm-border": "#E6DCCA",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        serif: ["var(--font-lora)", "Georgia", "serif"],
      },
      backgroundImage: {
        "grid-glow":
          "radial-gradient(circle at 20% 20%, rgba(91,141,255,0.15), transparent 40%), radial-gradient(circle at 80% 0%, rgba(122,240,196,0.12), transparent 35%)",
      },
    },
  },
  plugins: [],
};
export default config;
