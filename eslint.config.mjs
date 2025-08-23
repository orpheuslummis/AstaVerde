import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import globals from "globals";

export default [
    // Base JavaScript configuration
    js.configs.recommended,
    
    // Global ignores
    {
        ignores: [
            "node_modules/**",
            "artifacts/**",
            "cache/**",
            "coverage/**",
            "dist/**",
            "types/**",
            "webapp/**",
            "**/*.sol",
            ".git/**",
            "typechain-types/**"
        ]
    },
    
    // Default configuration for all files
    {
        files: ["**/*.js", "**/*.mjs", "**/*.ts"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: {
                ...globals.node,
                ...globals.mocha
            }
        },
        rules: {
            "semi": ["error", "always"],
            "quotes": ["error", "double", { "avoidEscape": true }],
            "indent": ["error", 4],
            "comma-dangle": ["error", "always-multiline"],
            "no-trailing-spaces": "error",
            "eol-last": ["error", "always"],
            "no-console": ["warn", { "allow": ["warn", "error"] }],
            "no-unused-vars": "off" // Turned off in favor of TypeScript rule
        }
    },
    
    // TypeScript specific configuration
    {
        files: ["**/*.ts"],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                project: false // Disable type checking for performance
            }
        },
        plugins: {
            "@typescript-eslint": tsPlugin
        },
        rules: {
            ...tsPlugin.configs.recommended.rules,
            "@typescript-eslint/no-unused-vars": ["warn", {
                "argsIgnorePattern": "^_",
                "varsIgnorePattern": "^_"
            }],
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/no-require-imports": "off"
        }
    },
    
    // Test files configuration
    {
        files: ["test/**/*.ts", "test/**/*.js"],
        rules: {
            "@typescript-eslint/no-explicit-any": "off",
            "no-console": "off"
        }
    },
    
    // Scripts configuration
    {
        files: ["scripts/**/*.js", "scripts/**/*.mjs"],
        rules: {
            "no-console": "off"
        }
    },
    
    // Hardhat config and deployment scripts
    {
        files: ["hardhat.config.ts", "deploy/**/*.ts"],
        rules: {
            "@typescript-eslint/no-explicit-any": "off"
        }
    }
];