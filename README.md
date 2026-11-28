# Clean Bug Report

Guided bug-report form for async distributed teams built with Svelte 4, Tailwind CSS, and [@monos/ui](https://github.com/aa-blinov/monos-ui): capture repro steps, expected vs actual behavior, and environment context, then copy a Slack-ready summary or open a pre-filled GitHub Issue in one click.

[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![CI](https://github.com/aa-blinov/clean-bug-report/actions/workflows/ci.yml/badge.svg)](https://github.com/aa-blinov/clean-bug-report/actions/workflows/ci.yml)

Live app: [aa-blinov.github.io/clean-bug-report](https://aa-blinov.github.io/clean-bug-report/)

---

## Quick start

```bash
git clone https://github.com/aa-blinov/clean-bug-report.git
cd clean-bug-report
npm install
npm run dev
```

## What it does

- **Guided async structure:** title, severity, reproducibility, component area, numbered repro steps, expected vs actual behavior, environment, and optional stack traces.
- **Auto-detected context:** captures browser, OS, viewport dimensions, and local reporter timezone in one click.
- **One-click Slack & Markdown handoff:** live preview tabs for Slack `mrkdwn` and GitHub/Linear Markdown with completeness badges.
- **Direct GitHub Issue launch:** opens a pre-filled `issues/new` page in `aa-blinov/clean-bug-report` (or any repository passed via `?repo=owner/name` or selected in the UI).

## Configuration

| Parameter | Default | Description |
| --- | --- | --- |
| `?repo=<owner/name>` | `aa-blinov/clean-bug-report` | Pre-selects the target repository for **Create Ticket** |
| `?lang=<en\|ru>` | `en` | Sets the initial UI & output language (persisted in `localStorage`) |
| Color mode toggle | `dark` | Switches `@monos/ui` `data-mode` between `dark` and `light` (persisted in `localStorage`) |

## How it works

Form state lives in [src/App.svelte](src/App.svelte) using `@monos/ui` primitives, while pure formatting, environment detection, and GitHub Issue URL generation live in [src/lib/formatters.js](src/lib/formatters.js). See [docs/architecture.md](docs/architecture.md).

## Development

```bash
npm run dev     # start Vite dev server
npm run check   # run svelte-check
npm run build   # build static bundle to dist/
```

## License

[MIT](LICENSE)
