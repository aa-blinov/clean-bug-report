# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Distributed and async engineering, QA, and product teammates reporting bugs across timezones without live calls.

## Product Purpose

Eliminate incomplete bug reports by guiding reporters through title, severity, reproducibility, numbered steps, expected vs actual behavior, and auto-detected environment details, then exporting to Slack, Markdown, or a pre-filled GitHub Issue in one click.

## Positioning

Built on `@monos/ui` and Svelte 4 as a zero-backend static web tool that works immediately on GitHub Pages without Slack tokens or GitHub OAuth setup.

## Operating Context

Served statically on GitHub Pages (`https://aa-blinov.github.io/clean-bug-report/`) and runnable locally via Vite (`npm run dev`). Supports `?repo=owner/name` URL pre-selection.

## Capabilities and Constraints

- Client-side only: generates Slack `mrkdwn`, GitHub/Linear Markdown, and pre-filled GitHub `issues/new` URLs.
- Auto-detects browser, OS, viewport dimensions, and local reporter timezone via standard browser APIs.
- Does not store reports on a server or require authentication tokens.

## Brand Commitments

- Keep every required field scannable and obvious so async handoffs happen in one message.
- Follow `@monos/ui` tokens, light/dark themes, and accessible focus rings without custom visual overrides.

## Evidence on Hand

- `svelte-check` passed with `0 errors and 0 warnings` and `vite build` succeeded cleanly.
- Interactive form filling, `Open GitHub Issue` URL generation, and desktop/mobile layouts verified in Playwright with zero console errors.

## Product Principles

- **Async-first clarity:** make missing fields visible before copying or filing.
- **One-click output:** Slack summary, Markdown, and GitHub Issue creation each take a single click.

## Accessibility & Inclusion

- Built on `@monos/ui` accessible form controls, keyboard-navigable tabs, segmented controls, and `aria-label` icon actions.
- Supports both light and dark modes via `@monos/ui` theme tokens.
