/** @type {import("prettier").Config} */
export default {
  semi: true,
  singleQuote: true,
  printWidth: 100,
  trailingComma: 'all',
  plugins: ['prettier-plugin-astro', 'prettier-plugin-tailwindcss'],
  tailwindStylesheet: './src/styles/global.css',
  tailwindFunctions: ['cn', 'cva', 'clsx'],
  overrides: [
    {
      files: '*.astro',
      options: { parser: 'astro' },
    },
  ],
};
