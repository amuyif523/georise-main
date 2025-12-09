import daisyui from "daisyui";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
  plugins: [daisyui],
  daisyui: {
    themes: [
      {
        georiseCitizen: {
          primary: "#2563EB",
          secondary: "#16A34A",
          accent: "#F97316",
          neutral: "#0F172A",
          "base-100": "#F9FAFB",
          info: "#0EA5E9",
          success: "#22C55E",
          warning: "#FACC15",
          error: "#DC2626",
        },
      },
      {
        georiseCommand: {
          primary: "#3B82F6",
          secondary: "#22D3EE",
          accent: "#F97316",
          neutral: "#020617",
          "base-100": "#020617",
          "base-200": "#020617",
          info: "#0EA5E9",
          success: "#22C55E",
          warning: "#FACC15",
          error: "#EF4444",
        },
      },
    ],
    darkTheme: "georiseCommand",
  },
};
