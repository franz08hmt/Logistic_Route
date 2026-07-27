# Core Engine

Workspace for route optimization algorithms.

## Planned responsibilities

- Build a graph from road-network or provider data.
- Model vehicle capacity, delivery time windows, driver shifts, and service times.
- Produce deterministic route plans with explainable constraints.
- Keep the optimization engine independent from HTTP and UI concerns.

The first implementation should define input/output contracts and a small deterministic baseline before introducing an external solver.

