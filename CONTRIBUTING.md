# Contributing

Thank you for helping improve the Cavuno Board SDK.

## Before opening a change

- Search existing issues and pull requests.
- Open an issue first for significant behavior or interface changes.
- Never commit API keys, access tokens, customer data, non-public information,
  vulnerability details, or generated artifacts from an unreviewed
  specification.

## Development

1. Use a supported Node.js version.
2. Install dependencies with `pnpm install`.
3. Generate types only from the public Board API projection.
4. Build with `pnpm build`.
5. Run `pnpm test`, `pnpm typecheck`, and `pnpm check:publish`.

Keep changes focused and add tests for changed behavior. SDK methods must use
the documented Board API.

By submitting a contribution, you agree that it may be distributed under the
MIT License and that you have the right to submit it.
