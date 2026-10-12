import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Below this, a 3-up segmented control has to drop its glyphs to fit
      // the labels (a 390px iPhone is the case that forced it).
      screens: {
        xs: "420px",
      },
      colors: {
        // Echelon: deep navy, white type, one royal-blue accent. Green/red/amber are status only.
        bg: "#060B1A",
        bg2: "#08102A",
        surface: "#0C1530",
        surface2: "#101B3A",
        elevated: "#152247",
        line: "#1A2750",
        line2: "#25365F",
        ink: "#F5F7FC",
        muted: "#A4AFCB",
        faint: "#6F7B9C",
        // brand family — driven by the accent CSS vars (see src/lib/config.ts)
        brand: "rgb(var(--accent-rgb) / <alpha-value>)",
        brandDeep: "rgb(var(--accent-deep-rgb) / <alpha-value>)",
        violet: "rgb(var(--accent-light-rgb) / <alpha-value>)",
        plasma: "rgb(var(--accent-rgb) / <alpha-value>)",
        cyan: "rgb(var(--accent-light-rgb) / <alpha-value>)",
        accent: "rgb(var(--accent-rgb) / <alpha-value>)",
        accentDim: "rgb(var(--accent-deep-rgb) / <alpha-value>)",
        // semantics
        gold: "#F2B84B",
        mint: "#46D08A",
        positive: "#46D08A",
        positiveDim: "#1c6b45",
        silver: "#C4CCD8",
        bronze: "#D08A4B",
        warn: "#E9B44C",
        danger: "#FF6B7A",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "4xl": "20px",
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        pulseDot: {
          "0%,100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.35", transform: "scale(0.8)" },
        },
        spinSlow: { to: { transform: "rotate(360deg)" } },
        sheen: {
          "0%": { transform: "translateX(-120%)" },
          "60%,100%": { transform: "translateX(220%)" },
        },
        floaty: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
      animation: {
        marquee: "marquee 38s linear infinite",
        pulseDot: "pulseDot 1.8s ease-in-out infinite",
        spinSlow: "spinSlow 6s linear infinite",
        sheen: "sheen 3.5s ease-in-out infinite",
        floaty: "floaty 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
