import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        shinhan: {
          blue: '#0046FF',
          darkGray: '#333333',
          lightGray: '#F5F5F5',
          border: '#E0E0E0',
          error: '#E53935',
          success: '#43A047',
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      maxWidth: {
        'content': '1920px',
      },
      screens: {
        'tablet': '768px',
        'desktop': '1920px',
      },
    },
  },
  plugins: [],
};
export default config;
