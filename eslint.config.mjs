import js from "@eslint/js";
import tseslint from "typescript-eslint";
import obsidian from "eslint-plugin-obsidianmd";
import globals from "globals";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Ignore compiled output files
    ignores: ["main.js", "*.js", "!eslint.config.mjs"],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      obsidianmd: obsidian,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        sourceType: "module",
      },
    },
    rules: {
      ...obsidian.configs.recommended.rules,
      "no-console": "error",
      "no-debugger": "error",
      "@typescript-eslint/no-explicit-any": "warn",
    },
  }
);