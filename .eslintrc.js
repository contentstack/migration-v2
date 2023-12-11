module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: ["prettier"],
  plugins: [],
  rules: {
    "operator-linebreak": [
      "error",
      "after",
      {
        overrides: {
          ":": "before",
        },
      },
    ],
    "func-names": [0],
    "no-console": ["error", { allow: ["warn", "error", "info"] }],
  },
};
