# Repository Guidelines

## Project Structure & Module Organization

- `contracts/`: Solidity sources (0.8.27). ABI is exported to `webapp/src/config/` on compile.
- `test/`: Mocha/Chai tests in TypeScript; integration and behavior specs live here.
- `scripts/` and `tasks/`: Hardhat utilities, QA flows, local dev bootstrap.
- `deploy/` and `deployments/`: Network deployment logic and artifacts.
- `webapp/`: Next.js frontend (Tailwind). Reads contract config from `webapp/src/config/`.
- Generated: `artifacts/`, `cache/`, `types/`, `coverage/` (do not commit).

## Build, Test, and Development Commands

- Compile contracts: `npm run compile` (also syncs `AstaVerde` ABI to the webapp).
- Run tests: `npm test` (Mocha via Hardhat).
- Coverage: `npm run coverage` (outputs `coverage/`, updates `types/`).
- Lint/format: `npm run lint` | `npm run prettier:check` | `npm run prettier:write`.
- Local dev chain + sample data: `node scripts/start-local-node.js`.
- Webapp dev: `npm run webapp:install` then `npm run webapp:dev`.
- Build all (contracts+tests+webapp): `npm run build:all`.
- Deploy: `npm run deploy:testnet` or `npm run deploy:mainnet` (requires env vars).

## Coding Style & Naming Conventions

- Indentation: 4 spaces (`.editorconfig`). Max line length 120 (`.prettierrc`).
- Solidity: solhint + prettier-plugin-solidity; visibility explicit; follow CamelCase for contracts and PascalCase for files.
- TypeScript: strict mode (`tsconfig.json`); prefer named exports; PascalCase for types, camelCase for variables/functions.
- Generated types: import from `types/` (TypeChain ethers-v6).

## Testing Guidelines

- Frameworks: Hardhat + Mocha/Chai; tests in `test/**/*.ts`.
- Conventions: co-locate helpers as `*.fixture.ts`/`lib.ts`; integration suites named by component (e.g., `AstaVerde.logic.behavior.ts`).
- Run fast QA flows: `npm run qa:fast`; full flows: `npm run qa:full` (localhost).

## Commit & Pull Request Guidelines

- Conventional messages: `feat:`, `fix:`, `docs:`, `chore:`, `style:`, `deps:` with optional scope (e.g., `fix(webapp): ...`).
- PRs must include: concise description, linked issues, test results (or steps), and screenshots/GIFs for webapp changes.
- Before requesting review: `npm run compile && npm test && npm run prettier:check` and ensure ABI sync if contracts changed.

## Security & Configuration Tips

- Secrets: use `.env.local`; never commit keys. Required: `MNEMONIC`/`PRIVATE_KEY`, `RPC_API_KEY`, explorer API keys.
- Networks: Hardhat (local), Base Sepolia, Base Mainnet (see `hardhat.config.ts`).
- Verify builds before deploy: `npm run verify:deploy`.
