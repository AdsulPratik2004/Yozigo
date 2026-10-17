/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0a0a0a",
          light: "#ffffff",
        },
        card: {
          DEFAULT: "#141414",
          light: "#f8f9fa",
          hover: "#1a1a1a",
          hoverLight: "#e9ecef",
        },
        line: {
          DEFAULT: "#262626",
          light: "#e9ecef",
        },
        accent: {
          DEFAULT: "#DC143C", // BookMyShow Crimson
          hover: "#B81030",
          light: "#FF2D55",
        },
        muted: {
          DEFAULT: "#a3a3a3",
          light: "#6c757d",
        },
        success: "#10B981",
        warning: "#F59E0B",
        gold: "#FFD700",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        'glow': '0 0 20px rgba(220, 20, 60, 0.3)',
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -1px rgba(0, 0, 0, 0.3)',
        'card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.3)',
        'card-light': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.05)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hero': 'linear-gradient(135deg, #0a0a0a 0%, #1a0a0a 100%)',
        'hero-light': 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
      },
    },
  },
  plugins: [],
};
