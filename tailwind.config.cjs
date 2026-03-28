/**** Tailwind config for standalone MotoCarePro ****/
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Custom theme colors using CSS variables
        primary: {
          bg: "rgb(var(--color-bg-primary) / <alpha-value>)",
          text: "rgb(var(--color-text-primary) / <alpha-value>)",
          border: "rgb(var(--color-border-primary) / <alpha-value>)",
        },
        secondary: {
          bg: "rgb(var(--color-bg-secondary) / <alpha-value>)",
          text: "rgb(var(--color-text-secondary) / <alpha-value>)",
          border: "rgb(var(--color-border-secondary) / <alpha-value>)",
        },
        tertiary: {
          bg: "rgb(var(--color-bg-tertiary) / <alpha-value>)",
          text: "rgb(var(--color-text-tertiary) / <alpha-value>)",
        },
        accent: {
          blue: {
            bg: "rgb(var(--color-accent-blue-bg) / <alpha-value>)",
            text: "rgb(var(--color-accent-blue-text) / <alpha-value>)",
            border: "rgb(var(--color-accent-blue-border) / <alpha-value>)",
          },
          green: {
            bg: "rgb(var(--color-accent-green-bg) / <alpha-value>)",
            text: "rgb(var(--color-accent-green-text) / <alpha-value>)",
            border: "rgb(var(--color-accent-green-border) / <alpha-value>)",
          },
          purple: {
            bg: "rgb(var(--color-accent-purple-bg) / <alpha-value>)",
            text: "rgb(var(--color-accent-purple-text) / <alpha-value>)",
            border: "rgb(var(--color-accent-purple-border) / <alpha-value>)",
          },
          orange: {
            bg: "rgb(var(--color-accent-orange-bg) / <alpha-value>)",
            text: "rgb(var(--color-accent-orange-text) / <alpha-value>)",
            border: "rgb(var(--color-accent-orange-border) / <alpha-value>)",
          },
          red: {
            bg: "rgb(var(--color-accent-red-bg) / <alpha-value>)",
            text: "rgb(var(--color-accent-red-text) / <alpha-value>)",
            border: "rgb(var(--color-accent-red-border) / <alpha-value>)",
          },
        },
      },
      keyframes: {
        "slide-up": {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
      },
      animation: {
        "slide-up": "slide-up 0.3s ease-out",
      },
      borderWidth: {
        3: "3px",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
