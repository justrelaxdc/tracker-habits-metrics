// eslint.config.mjs
import tsparser from "@typescript-eslint/parser";
import tseslint from "@typescript-eslint/eslint-plugin";
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
  // Ignore config files and compiled output to avoid TypeScript rule errors
  {
    ignores: [
      "eslint.config.js",
      "*.config.js",
      "**/*.config.js",
      "main.js",
      "node_modules/**",
    ],
  },
  // Apply obsidianmd recommended config and TypeScript rules to source files
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    plugins: {
      obsidianmd,
      "@typescript-eslint": tseslint,
    },
    languageOptions: {
      parser: tsparser,
      parserOptions: { project: "./tsconfig.json" },
    },
    rules: {
      ...obsidianmd.configs.recommended,
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": "error",
    },
  },
]);