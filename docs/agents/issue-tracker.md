# Issue tracker: Local Markdown

Issues and specs for this repo live as Markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`.
- The spec is `.scratch/<feature-slug>/spec.md`.
- Implementation issues are one file per ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`.
- Record triage state as a `Status:` line near the top of each issue file.
- Append comments and conversation history under a `## Comments` heading.

When a skill says to publish an issue, create a file in the feature directory. When it says to fetch a ticket, read the referenced path or issue number.

## Wayfinding

- Map: `.scratch/<effort>/map.md`.
- Child ticket: `.scratch/<effort>/issues/NN-<slug>.md`, with a `Type:` line (`research`, `prototype`, `grilling`, or `task`) and a `Status:` line (`claimed` or `resolved`).
- Blocking: `Blocked by: NN, NN` near the top. A ticket is unblocked when every listed ticket is resolved.
- Frontier: choose the lowest-numbered open, unblocked, unclaimed ticket.
- Claim: set `Status: claimed` before work.
- Resolve: append the answer under `## Answer`, set `Status: resolved`, and add a summary and link to the map's decisions.
