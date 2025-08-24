module.exports = {
    root: true,
    env: {
        node: true,
        es2022: true,
        mocha: true
    },
    extends: [
        "eslint:recommended"
    ],
    parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module"
    },
    ignorePatterns: [
        "node_modules/**",
        "**/node_modules/**",
        "artifacts/**",
        "cache/**",
        "coverage/**",
        "dist/**",
        "types/**",
        "**/*.sol",
        ".git/**",
        "typechain-types/**",
        "webapp/.next/**",
        "webapp/out/**",
        "webapp/public/**",
        "webapp/.cache-synpress/**",
        "**/.cache-synpress/**"
    ],
    rules: {
        "semi": ["error", "always"],
        "quotes": ["error", "double", { "avoidEscape": true }],
        "indent": ["error", 4],
        "comma-dangle": ["error", "always-multiline"],
        "no-trailing-spaces": "error",
        "eol-last": ["error", "always"],
        "no-console": ["warn", { "allow": ["warn", "error"] }],
        "no-unused-vars": "off" // Turned off in favor of TypeScript rule
    },
    overrides: [
        // TypeScript files
        {
            files: ["**/*.ts"],
            parser: "@typescript-eslint/parser",
            parserOptions: {
                project: false,
                ecmaVersion: "latest",
                sourceType: "module"
            },
            plugins: ["@typescript-eslint"],
            extends: [
                "eslint:recommended",
                "plugin:@typescript-eslint/recommended"
            ],
            rules: {
                "@typescript-eslint/no-unused-vars": ["warn", {
                    "argsIgnorePattern": "^_",
                    "varsIgnorePattern": "^_"
                }],
                "@typescript-eslint/no-explicit-any": "warn",
                "@typescript-eslint/no-require-imports": "off",
                "no-unused-vars": "off"
            }
        },
        // Test files
        {
            files: ["test/**/*.ts", "test/**/*.js"],
            rules: {
                "@typescript-eslint/no-explicit-any": "off",
                "no-console": "off"
            }
        },
        // Scripts
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
        },
        // Webapp files - basic rules only, webapp config handles TypeScript/React
        {
            files: ["webapp/**/*.ts", "webapp/**/*.tsx", "webapp/**/*.js", "webapp/**/*.jsx"],
            env: {
                browser: true,
                node: true
            },
            globals: {
                React: "readonly"
            },
            rules: {
                "indent": ["error", 2], // Webapp uses 2 spaces
                "no-console": ["warn", { "allow": ["warn", "error"] }]
            }
        },
        // Webapp test files
        {
            files: [
                "webapp/**/__tests__/**/*",
                "webapp/**/*.test.*",
                "webapp/**/test-*.ts",
                "webapp/**/mock-*.ts"
            ],
            rules: {
                "@typescript-eslint/no-explicit-any": "off",
                "@typescript-eslint/no-unused-vars": "off",
                "no-console": "off"
            }
        }
    ]
};