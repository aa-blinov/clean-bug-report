# Architecture

`clean-bug-report` is a static Svelte 4 + Tailwind CSS + `@monos/ui` application:

1. **`src/lib/formatters.js`**
   - Pure helper functions with zero DOM side effects beyond optional `navigator` / `Intl` environment detection.
   - `buildSlackSummary(report)` formats compact Slack `mrkdwn` with severity, environment, numbered repro steps, expected/actual, logs, and reporter timezone.
   - `buildMarkdown(report)` generates full GitHub/Linear Markdown.
   - `buildGitHubIssueUrl(report, repoSlug)` builds a `https://github.com/<owner>/<repo>/issues/new` URL with URL-encoded `title`, `body`, and `labels=bug`.

2. **`src/App.svelte`**
   - Renders the 4-step guided form using `@monos/ui` primitives and binds reactive previews (`slackOutput`, `markdownOutput`, `completeness`, `githubIssueUrl`).
   - Supports `?repo=owner/name` URL pre-selection and light/dark `data-mode` toggling.
