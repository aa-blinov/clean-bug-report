# AGENTS.md — agent context for `clean-bug-report`

Guided async bug-report builder using Svelte 4, Tailwind CSS, and `@monos/ui` with one-click Slack, Markdown, and pre-filled GitHub Issue handoff.

## Run / build / test

```bash
npm ci
npm run check
npm run build
```

## Where things live

| Path | What it is |
| --- | --- |
| `src/App.svelte` | Main layout, `@monos/ui` form cards, live preview tabs, and copy/issue actions |
| `src/lib/formatters.js` | `buildSlackSummary`, `buildMarkdown`, `buildGitHubIssueUrl`, `detectDeviceSummary` |
| `src/app.css` | Imports `@monos/ui/styles.css` and Tailwind layers |
| `tailwind.config.js` | Applies `@monos/ui/tailwind-preset` and scans `@monos/ui` Svelte sources |
| `docs/` | Architecture and screenshot references |

## Traps

- **Keep `base: './'` in `vite.config.js`.** Required for GitHub Pages subpath hosting under `/clean-bug-report/`.
- **Do not commit secrets or tokens.** GitHub Issue creation works via pre-filled `issues/new` URLs rather than authenticated API calls.
