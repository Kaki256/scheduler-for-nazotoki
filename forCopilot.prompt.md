---
agent: agent
---

# Markdown Prompt

## Primary Directive

- Think in English.
- Interact with the user in Japanese.

## TDD Directive (t-wada style)

- Follow the spirit of "t-wada style TDD". Strictly follow the Red → Green → Refactor cycle:

  1. Write the smallest failing test (Red).

  - Tests should be specific and focused on a single behavior.
  - Test names should be descriptive sentences (e.g. "normalizeAnswer should NFKC-normalize and trim input").

  2. Implement the minimal code to make the test pass (Green).

  - Implement only what is necessary to satisfy the test; avoid premature abstraction.

  3. Refactor with confidence (Refactor).

  - Refactor while keeping tests green. If behavior changes are needed, add tests first.

  4. Iterate quickly with small commits.

  - Repeat: write test → implement → make test pass → commit.

- Treat tests as executable specification and living documentation.

## Testing Guidelines

- Test framework: Vitest.
- Test layers:
  - Unit tests: pure utilities and small functions.
  - Integration tests: compatibility between Node generate script and browser WebCrypto output.
  - Component-level tests: Vue components interacting with Web Worker and utils.
- Mocks:
  - Use mocks carefully. Prefer integration tests for crypto compatibility.
  - Stub network calls, but do not hide implicit behavior behind excess mocking.
- Tests must be deterministic and fast. Separate slow tests and run them selectively in CI.

## Priority test list (first to write)

1. normalizeAnswer unit tests

- Ensure trim and Unicode NFKC normalization.
- Include cases with full/half-width characters and composed/decomposed forms.

2. Compatibility test between Node generate script and browser implementation

- Given a plain problem, Node's pbkdf2Sync output should match browser pbkdf2 deriveBits output.

3. pbkdf2Hex browser unit tests

- Known vectors: (password, salt, iterations) → expected hex (from Node).

4. UI integration: Answer input → Worker → compare → show result

- Worker calculates derived key and returns correctness; component displays result.

5. generate-hashes output format test

- data/problems.json must contain required fields: id, salt, iterations, keylen, algo, hash.

## Test file layout (suggested)

- src/utils/hash.ts tests → tests/unit/hash.spec.ts
- scripts/generate-hashes.js tests → tests/integration/generate.spec.ts
- Vue component tests → tests/component/AnswerInput.spec.ts
- E2E (optional) → e2e/\* (Playwright)

## CI (test-related)

- On PR / push:
  - pnpm install
  - pnpm lint
  - pnpm test (Vitest headless)
  - pnpm build
  - pnpm build-storybook
- Fail-fast: tests failing block merges.

## Developer commands (document in README)

- Dev: pnpm dev
- Test: pnpm test
- Test (watch): pnpm test:watch
- Generate hashes (local only): node scripts/generate-hashes.js
- Storybook: pnpm storybook
- Build Storybook: pnpm build-storybook

## Commit & PR rules (simple)

- Commit small, frequent changes. Push only when tests pass.
- When adding behavior, add tests first.
- Prefer Conventional Commits (e.g. feat: add normalizeAnswer tests).

## Notes on crypto tests and platform compatibility

- Verify Node.js crypto.pbkdf2Sync and browser WebCrypto produce identical derived key bytes when using the same parameters (encoding, normalization, salt bytes).
- Use explicit encodings (UTF-8) and clear normalization rules in tests to avoid cross-platform inconsistencies.

---
