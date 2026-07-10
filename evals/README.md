# Evaluation Strategy

TaskTime Pro currently contains deterministic product and agent-command behavior rather than model-generated application behavior. Its executable correctness evidence therefore lives primarily in:

- colocated Vitest unit/component tests under `src/`
- integration tests under `src/test/integration/`
- Playwright user-flow tests under `e2e/`
- agent bridge, bundle, and live smoke scripts under `scripts/`
- public backup compatibility fixtures under `test-data/backups/`

Add structured fixtures under `evals/` when the repository introduces prompts, retrieval, ranking, model output, or other probabilistic behavior that cannot be adequately specified by deterministic tests. Each such eval must state its input, expected properties, failure threshold, and Docker-backed execution command.

Editor workflow prompts under `.github/prompts/` are validated structurally for frontmatter, file references, and ownership rules. They do not themselves change product behavior.
