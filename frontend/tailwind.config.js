/** @type {import('tailwindcss').Config} */
module.exports = {
  content: {
    files: [
      "./app/**/*.{ts,tsx}",
      "./components/**/*.{ts,tsx}",
      "./features/**/*.{ts,tsx}",
      "./shared/**/*.{ts,tsx}",
      "./core/**/*.{ts,tsx}",
    ],
    ignore: [
      "**/*.agent",
      "**/agents/**",
      "**/skills/**",
      "**/*.json",
      "**/*.yaml",
      "**/*.yml",
      "**/*.txt",
      "**/*.md",
      "**/*.db",
      "**/*.sql",
    ],
  },

  theme: {
    screens: {
      xs: "480px",
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },
    extend: {
      keyframes: {
        aurora: {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        aurora: "aurora 6s ease-in-out infinite",
        shimmer: "shimmer 2s infinite",
      },
    },
  },

  plugins: [],
};
