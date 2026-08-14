import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bgPrimary: "#0B0B0D",
        bgSurface: "#161618",
        gold: "#C9A227",
        goldSoft: "#E8D48A",
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
