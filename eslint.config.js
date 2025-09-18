// eslint.config.js
const tseslint = require('typescript-eslint');
const reactPlugin = require('eslint-plugin-react');

module.exports = tseslint.config({
  files: ["ui/src/**/*.{ts,tsx,js,jsx}", "api/src/**/*.{ts,tsx,js,jsx}"], // only source code
  ignores: ["dist/**", "build/**", "node_modules/**", ".eslintrc.js"],
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: {
      project: './tsconfig.json',
      tsconfigRootDir: __dirname,
    },
  },
  plugins: {
    '@typescript-eslint': require('@typescript-eslint/eslint-plugin'),
    'react': reactPlugin,
  },
  rules: {
    "@typescript-eslint/no-unused-vars": "off",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/no-var-requires": "off",
    "no-console": "off",
    "react/no-unknown-property": "off",
    "react/react-in-jsx-scope": "off"
  }
});
