import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["node_modules/", ".worktrees/", ".agent-runs/", "dist/"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "no-console": ["error", { allow: ["error"] }],
    },
  },
  {
    // チーム運用スクリプト（Node で直接実行する .mjs）
    files: ["scripts/**/*.mjs", "eslint.config.js"],
    languageOptions: { globals: { process: "readonly", console: "readonly" } },
  },
);
