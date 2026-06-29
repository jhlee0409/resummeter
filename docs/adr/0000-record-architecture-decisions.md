# 0. Record architecture decisions

- Status: accepted
- Date: 2026-06-29

## Context

We want a lightweight, durable record of the non-obvious, hard-to-reverse
decisions made in this project — module boundaries, trade-offs, technology
choices — so future work (and future sessions) can see *why*, not just *what*.

## Decision

We record significant decisions as numbered Architecture Decision Records (ADRs)
in `docs/adr/`, one file per decision, using `/harness-kit:adr <title>` to
scaffold the next number. Each ADR captures context, the decision, and its
consequences. An ADR is immutable once accepted; a later decision supersedes it
with a new record rather than editing the old one.

## Consequences

- Decisions are discoverable and reviewable in the repo, not lost in chat.
- Small/obvious choices stay out — ADRs are for the non-obvious ones only.
