/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    // Include interface packages
    '../packages/interface-*/components/**/*.{js,jsx}',
    '../packages/interface-*/render.jsx',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
