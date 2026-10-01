import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "prefer-const": "off",
      "import/no-anonymous-default-export": "off",
      "@typescript-eslint/no-unused-vars": "warn"
    }
  },
  globalIgnores([".next/**", "dist/**", "node_modules/**"])
]);
