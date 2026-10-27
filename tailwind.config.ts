import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}", "./lib/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bgPrimary: "rgb(var(--c-bg) / <alpha-value>)",
        bgSurface: "rgb(var(--c-surface) / <alpha-value>)",
        gold: "rgb(var(--c-gold) / <alpha-value>)",
        goldSoft: "rgb(var(--c-goldSoft) / <alpha-value>)",
        sec: "rgb(var(--c-sec) / <alpha-value>)",
        sec2: "rgb(var(--c-sec2) / <alpha-value>)",
        offwhite: "#F5F5F2",
        muted: "#8A8A8E",
        success: "#3FA76B",
        danger: "#C24747",
        rose: "#B76E79",
      },
    },
  },
  plugins: [],
};
export default config;
