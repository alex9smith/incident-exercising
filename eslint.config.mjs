import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import { includeIgnoreFile } from "@eslint/compat";
import { fileURLToPath } from "node:url";
import vitestEslint from "@vitest/eslint-plugin";
import nodeEslint from "eslint-plugin-n";
import { defineConfig } from "eslint/config";

// eslint-disable-next-line no-restricted-exports
export default defineConfig(
  includeIgnoreFile(
    fileURLToPath(new URL(".gitignore", import.meta.url)),
    "Imported .gitignore patterns",
  ),
  {
    ignores: ["eslint.config.*", "dist/"],
  },
  {
    files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
    languageOptions: {
      parser: null,
      parserOptions: {
        projectService: false,
      },
    },
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["*.config.ts"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  nodeEslint.configs["flat/recommended-script"],
  {
    files: ["src/cli.ts"],
    rules: {
      "n/hashbang": [
        "error",
        {
          convertPath: {
            "src/**/*.ts": ["^src/(.+)\\.ts$", "dist/$1.js"],
          },
        },
      ],
    },
  },
  {
    rules: {
      "no-console": "off",
      "@typescript-eslint/consistent-type-imports": "error",
      "no-restricted-exports": [
        "error",
        {
          restrictDefaultExports: {
            direct: true,
            named: true,
            defaultFrom: true,
            namedFrom: true,
            namespaceFrom: true,
          },
        },
      ],
      "n/no-sync": "off",
      "n/no-unpublished-import": "off",
      "n/no-missing-import": [
        "error",
        {
          ignoreTypeImport: true,
        },
      ],
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/consistent-type-assertions": [
        "error",
        {
          assertionStyle: "never",
        },
      ],
    },
  },
  {
    plugins: {
      // @ts-expect-error -- plugin lacks flat-config types
      vitest: vitestEslint,
    },
    files: ["**/*.test.ts"],
    rules: {
      ...vitestEslint.configs.recommended.rules,
      "vitest/no-focused-tests": "error",
    },
  },
);
