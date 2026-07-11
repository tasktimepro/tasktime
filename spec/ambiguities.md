# Ambiguities And Open Decisions

Unknowns are recorded here rather than silently resolved by an agent.

## Architecture and operations

### Historical compatibility support window

The repository validates tolerant historical shapes, but there is no single documented minimum supported backup/app version. Do not remove compatibility code until a support policy and migration evidence exist.

### Dedicated agent evals

Agent commands are deterministic and currently use tests/smoke flows. If future integrations add model-authored planning or interpretation inside this repository, define eval fixtures and thresholds before shipping that behavior.
