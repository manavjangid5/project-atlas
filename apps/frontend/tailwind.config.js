/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0A0A0B",
        surface: "#161616",
        surfaceHover: "#1F1F1F",
        border: "#2A2A2A",
        text: "#F5F5F5",
        muted: "#9E9E9E",
        accent: "#E8622C",
        accentHover: "#D6541F",
        danger: "#FF5C5C",
      },
      fontFamily: {
        sans: ["'Inter'", "system-ui", "sans-serif"],
      },
      borderRadius: {
        sm: "8px",
        md: "14px",
        lg: "24px",
        pill: "999px",
      },
    },
  },
  plugins: [],
};