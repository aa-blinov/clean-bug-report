<script>
  import {
    Badge,
    Button,
    Card,
    FileUpload,
    Notice,
    SegmentedControl,
    SelectField,
    Separator,
    Tabs,
    TextArea,
    TextField,
    Toaster,
    toast
  } from '@monos/ui';
  import {
    Check,
    Copy,
    ExternalLink,
    FileText,
    MessageSquare,
    Moon,
    Plus,
    RotateCcw,
    Sparkles,
    Sun,
    Trash2
  } from 'lucide-svelte';
  import {
    ENV_OPTIONS,
    EXAMPLE_REPORT,
    REPO_OPTIONS,
    REPRO_RATE_OPTIONS,
    SEVERITY_OPTIONS,
    buildGitHubIssueUrl,
    buildMarkdown,
    buildSlackSummary,
    createEmptyReport,
    detectDeviceSummary,
    detectTimezone,
    getCompleteness
  } from './lib/formatters.js';

  const DRAFT_KEY = 'clean-bug-report:draft:v1';
  const MODE_KEY = 'clean-bug-report:mode';

  function loadInitialMode() {
    try {
      const saved = localStorage.getItem(MODE_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      // Ignore storage errors
    }
    return 'dark';
  }

  function loadInitialReport() {
    const base = createEmptyReport();
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return base;
      const parsed = JSON.parse(raw);
      return {
        ...base,
        ...parsed,
        steps: Array.isArray(parsed.steps) && parsed.steps.length ? parsed.steps : base.steps
      };
    } catch {
      return base;
    }
  }

  let mode = loadInitialMode();
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-mode', mode);
  }
  let report = loadInitialReport();
  let attachedFiles = [];
  let previewTab = 'slack';
  let copiedFormat = '';
  let copiedTimer = null;
  let submitting = false;
  let createdIssue = null;
  let honeypot = '';

  const TICKETS_API_URL = import.meta.env.VITE_TICKETS_API_URL || '';

  const urlRepo =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('repo')?.trim() || ''
      : '';
  const presetMatch = REPO_OPTIONS.some((o) => o.value === urlRepo && o.value !== 'custom');
  let selectedRepo = urlRepo ? (presetMatch ? urlRepo : 'custom') : REPO_OPTIONS[0].value;
  let customRepo = urlRepo && !presetMatch ? urlRepo : '';
  let showRepoPicker = !urlRepo;

  $: {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(report));
    } catch {
      // Ignore storage quota issues
    }
  }

  $: targetRepo = selectedRepo === 'custom' ? customRepo : selectedRepo;
  $: githubIssueUrl = buildGitHubIssueUrl(report, targetRepo);
  $: markdownOutput = buildMarkdown(report, attachedFiles);
  $: slackOutput = buildSlackSummary(report, attachedFiles);
  $: completeness = getCompleteness(report);

  const previewTabs = [
    { id: 'slack', label: 'Slack Summary' },
    { id: 'markdown', label: 'Markdown' }
  ];

  function toggleMode() {
    mode = mode === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-mode', mode);
    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch {
      // Ignore storage errors
    }
  }

  function addStep() {
    report.steps = [...report.steps, ''];
  }

  function removeStep(index) {
    if (report.steps.length <= 1) {
      report.steps = [''];
      return;
    }
    report.steps = report.steps.filter((_, i) => i !== index);
  }

  function updateStep(index, value) {
    if (value.includes('\n')) {
      const lines = value
        .split(/\r?\n/)
        .map((l) => l.replace(/^\s*\d+[.)]\s*/, '').trim())
        .filter(Boolean);
      if (lines.length > 1) {
        const next = [...report.steps];
        next.splice(index, 1, ...lines);
        report.steps = next;
        return;
      }
    }
    const next = [...report.steps];
    next[index] = value;
    report.steps = next;
  }

  function loadExample() {
    report = {
      ...EXAMPLE_REPORT,
      steps: [...EXAMPLE_REPORT.steps]
    };
    toast({ title: 'Loaded async team example', tone: 'info', duration: 2200 });
  }

  function resetForm() {
    report = createEmptyReport();
    attachedFiles = [];
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // Ignore storage failures
    }
    toast({ title: 'Cleared form', duration: 1800 });
  }

  function autoDetectEnv() {
    report.device = detectDeviceSummary();
    report.timezone = detectTimezone();
    toast({ title: 'Updated browser, viewport & timezone', duration: 2000 });
  }

  async function submitTicket() {
    if (!githubIssueUrl) {
      toast({
        title: 'Invalid repository slug',
        description: 'Use owner/repo format, e.g. aa-blinov/clean-bug-report.',
        tone: 'danger',
        duration: 2800
      });
      return;
    }

    if (!TICKETS_API_URL) {
      window.open(githubIssueUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    if (!completeness.ready) {
      toast({
        title: 'Fill in required fields first',
        description: `Missing: ${completeness.missing.join(', ')}`,
        tone: 'warning',
        duration: 2800
      });
      return;
    }

    submitting = true;
    createdIssue = null;
    try {
      const res = await fetch(TICKETS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo: targetRepo,
          title: `[${report.severity.toUpperCase()}] ${report.title.trim()}`,
          body: markdownOutput,
          labels: ['bug'],
          website: honeypot
        })
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      createdIssue = { number: data.number, url: data.url };
      toast({
        title: `Ticket #${data.number} created`,
        description: `Filed into ${targetRepo}.`,
        tone: 'success',
        duration: 3500
      });
    } catch (err) {
      toast({
        title: 'Direct submit failed — opening GitHub',
        description: err instanceof Error ? err.message : 'Falling back to pre-filled GitHub Issue.',
        tone: 'warning',
        duration: 3200
      });
      window.open(githubIssueUrl, '_blank', 'noopener,noreferrer');
    } finally {
      submitting = false;
    }
  }

  async function copyText(text, kind) {
    try {
      await navigator.clipboard.writeText(text);
      copiedFormat = kind;
      if (copiedTimer) clearTimeout(copiedTimer);
      copiedTimer = setTimeout(() => {
        copiedFormat = '';
      }, 1800);
      toast({
        title: kind === 'slack' ? 'Slack summary copied' : 'Markdown copied',
        description: completeness.ready
          ? 'Ready to paste into Slack or an issue tracker.'
          : `Copied, though ${completeness.missing.join(', ')} still empty.`,
        tone: completeness.ready ? 'success' : 'warning',
        duration: 2800
      });
    } catch {
      toast({
        title: 'Clipboard access blocked',
        description: 'Select the preview text manually to copy.',
        tone: 'danger',
        duration: 3200
      });
    }
  }
</script>

<div class="min-h-screen bg-canvas text-ink">
  <header class="sticky top-0 z-menu border-b border-line bg-canvas">
    <div class="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <h1 class="truncate text-sm font-semibold tracking-tight text-ink sm:text-lg">
            Clean Bug Report
          </h1>
          <span class="hidden sm:inline-flex">
            <Badge tone="neutral">Async Teams</Badge>
          </span>
        </div>
        <p class="hidden text-xs text-ink-soft sm:block">
          Structured repro steps, expected vs actual, and one-click Slack &amp; Markdown handoff.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <Button variant="ghost" size="sm" on:click={loadExample}>
          <Sparkles class="h-3.5 w-3.5" />
          <span>Example</span>
        </Button>
        <Button variant="ghost" size="sm" on:click={resetForm}>
          <RotateCcw class="h-3.5 w-3.5" />
          <span class="hidden sm:inline">Reset</span>
        </Button>
        <Button variant="secondary" size="sm" on:click={toggleMode} aria-label="Toggle color mode">
          {#if mode === 'light'}
            <Moon class="h-3.5 w-3.5" />
          {:else}
            <Sun class="h-3.5 w-3.5" />
          {/if}
        </Button>
      </div>
    </div>
  </header>

  <main class="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)] lg:items-start">
    <section aria-label="Bug report form" class="space-y-4">
      <Card padding="lg">
        <div class="space-y-5">
          <div class="flex items-center justify-between gap-2">
            <h2 class="text-sm font-semibold uppercase tracking-wider text-ink-soft">
              1. Summary &amp; Impact
            </h2>
            <Badge tone={completeness.ready ? 'success' : 'warning'}>
              {completeness.filled}/{completeness.total} core fields
            </Badge>
          </div>

          <TextField
            label="Bug title"
            required
            variant="outline"
            placeholder="e.g. Checkout button stays disabled after 100% promo code"
            bind:value={report.title}
          />

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <span class="mb-1.5 block text-xs font-medium text-ink-soft">Severity</span>
              <SegmentedControl
                options={SEVERITY_OPTIONS}
                bind:value={report.severity}
                label="Severity"
                size="sm"
                full
              />
            </div>

            <div>
              <span class="mb-1.5 block text-xs font-medium text-ink-soft">Reproducibility</span>
              <SegmentedControl
                options={REPRO_RATE_OPTIONS}
                bind:value={report.reproducibility}
                label="Reproducibility"
                size="sm"
                full
              />
            </div>
          </div>

          <TextField
            label="Area / Feature"
            variant="outline"
            placeholder="e.g. Billing / Checkout"
            bind:value={report.area}
          />
        </div>
      </Card>

      <Card padding="lg">
        <div class="space-y-4">
          <div class="flex items-center justify-between gap-2">
            <div>
              <h2 class="text-sm font-semibold uppercase tracking-wider text-ink-soft">
                2. Steps to Reproduce
              </h2>
              <p class="mt-0.5 text-xs text-ink-faint">
                Write exact clicks or commands so a teammate in another timezone can verify without asking.
              </p>
            </div>
            <Button variant="secondary" size="sm" on:click={addStep}>
              <Plus class="h-3.5 w-3.5" />
              <span>Add step</span>
            </Button>
          </div>

          <div class="space-y-2.5">
            {#each report.steps as step, i (i)}
              <div class="flex items-center gap-2">
                <span class="w-6 shrink-0 text-right font-mono text-xs text-ink-faint">
                  {i + 1}.
                </span>
                <div class="min-w-0 flex-1">
                  <TextField
                    variant="outline"
                    size="sm"
                    placeholder={i === 0 ? 'Navigate to...' : i === 1 ? 'Click or enter...' : 'Observe...'}
                    value={step}
                    on:input={(e) => {
                      const target = /** @type {HTMLInputElement} */ (e.currentTarget || e.target);
                      updateStep(i, target?.value ?? '');
                    }}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  on:click={() => removeStep(i)}
                  aria-label="Remove step {i + 1}"
                >
                  <Trash2 class="h-3.5 w-3.5 text-ink-faint" />
                </Button>
              </div>
            {/each}
          </div>
        </div>
      </Card>

      <Card padding="lg">
        <div class="space-y-4">
          <h2 class="text-sm font-semibold uppercase tracking-wider text-ink-soft">
            3. Expected vs Actual
          </h2>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextArea
              label="Expected behavior"
              required
              variant="outline"
              rows={4}
              placeholder="What should happen?"
              bind:value={report.expected}
            />

            <TextArea
              label="Actual behavior"
              required
              variant="outline"
              rows={4}
              placeholder="What actually happened instead?"
              bind:value={report.actual}
            />
          </div>
        </div>
      </Card>

      <Card padding="lg">
        <div class="space-y-4">
          <div class="flex items-center justify-between gap-2">
            <h2 class="text-sm font-semibold uppercase tracking-wider text-ink-soft">
              4. Environment &amp; Context
            </h2>
            <Button variant="ghost" size="sm" on:click={autoDetectEnv}>
              Auto-detect
            </Button>
          </div>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField
              label="Environment"
              variant="outline"
              options={ENV_OPTIONS}
              bind:value={report.environment}
            />

            <TextField
              label="Device / Browser"
              variant="outline"
              bind:value={report.device}
            />

            <TextField
              label="URL / Build / Commit"
              variant="outline"
              placeholder="https://... or v2.14.3"
              bind:value={report.buildOrUrl}
            />

            <TextField
              label="Reporter timezone"
              variant="outline"
              bind:value={report.timezone}
            />
          </div>

          <TextArea
            label="Console logs / Stack trace (optional)"
            variant="outline"
            rows={3}
            placeholder="Paste relevant error output..."
            bind:value={report.logs}
          />
        </div>
      </Card>

      <Card padding="lg">
        <div class="space-y-4">
          <h2 class="text-sm font-semibold uppercase tracking-wider text-ink-soft">
            5. Attachments &amp; Media
          </h2>

          <TextArea
            label="Screencast or screenshot URLs (Loom, Jam, Drive — one per line)"
            variant="outline"
            rows={2}
            placeholder="https://www.loom.com/share/..."
            bind:value={report.attachmentUrls}
          />

          <FileUpload
            bind:files={attachedFiles}
            accept="image/*,video/*,.log,.txt,.json"
            label="Drop local screenshots, videos, or log files"
            chooseLabel="Choose files"
            hint="Static app: selected filenames are added to your report checklist so you remember to paste/drop them into Slack or GitHub."
          />
        </div>
      </Card>
    </section>

    <aside class="space-y-4 lg:sticky lg:top-20" aria-label="Shareable output">
      <Card padding="lg">
        <div class="space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="text-sm font-semibold uppercase tracking-wider text-ink-soft">
              One-Click Handoff
            </h2>
            {#if completeness.ready}
              <Badge tone="success">Async-ready</Badge>
            {:else}
              <Badge tone="warning">Missing: {completeness.missing.join(', ')}</Badge>
            {/if}
          </div>

          <div class="space-y-2.5 rounded-ui border border-line bg-canvas p-3">
            {#if showRepoPicker}
              <SelectField
                label="Target GitHub repository"
                variant="outline"
                size="sm"
                options={REPO_OPTIONS}
                bind:value={selectedRepo}
              />
              {#if selectedRepo === 'custom'}
                <TextField
                  label="Custom owner/repo"
                  variant="outline"
                  size="sm"
                  placeholder="owner/repository"
                  bind:value={customRepo}
                />
              {/if}
            {:else}
              <div class="flex items-center justify-between gap-2 text-xs">
                <span class="text-ink-soft">
                  Filing into <strong class="font-mono text-ink">{targetRepo}</strong>
                </span>
                <Button variant="ghost" size="sm" on:click={() => (showRepoPicker = true)}>
                  Change
                </Button>
              </div>
            {/if}

            <input
              type="text"
              tabindex="-1"
              autocomplete="off"
              aria-hidden="true"
              class="hidden"
              bind:value={honeypot}
            />

            <Button
              variant="primary"
              size="md"
              full
              loading={submitting}
              on:click={submitTicket}
            >
              <ExternalLink class="h-4 w-4 shrink-0" />
              <span>{TICKETS_API_URL ? 'Create Ticket' : 'Create Ticket on GitHub'}</span>
            </Button>

            {#if createdIssue}
              <Notice tone="success" title="Ticket #{createdIssue.number} created">
                <a
                  href={createdIssue.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="underline hover:opacity-80"
                >
                  Open issue in {targetRepo}
                </a>
              </Notice>
            {/if}
          </div>

          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              variant="secondary"
              size="sm"
              full
              on:click={() => copyText(slackOutput, 'slack')}
            >
              {#if copiedFormat === 'slack'}
                <Check class="h-3.5 w-3.5 shrink-0" />
                <span>Copied Slack!</span>
              {:else}
                <MessageSquare class="h-3.5 w-3.5 shrink-0" />
                <span>Copy Slack</span>
              {/if}
            </Button>

            <Button
              variant="secondary"
              size="sm"
              full
              on:click={() => copyText(markdownOutput, 'markdown')}
            >
              {#if copiedFormat === 'markdown'}
                <Check class="h-3.5 w-3.5 shrink-0" />
                <span>Copied MD!</span>
              {:else}
                <FileText class="h-3.5 w-3.5 shrink-0" />
                <span>Copy Markdown</span>
              {/if}
            </Button>
          </div>

          <Separator />

          <Tabs items={previewTabs} bind:value={previewTab} label="Output format">
            <svelte:fragment slot="panel" let:active>
              <div class="mt-3">
                <div class="mb-2 flex items-center justify-between">
                  <span class="text-xs text-ink-faint">
                    {active === 'slack' ? 'Slack mrkdwn preview' : 'GitHub / Linear Markdown'}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    on:click={() => copyText(active === 'slack' ? slackOutput : markdownOutput, active)}
                  >
                    <Copy class="h-3.5 w-3.5" />
                    <span>Copy</span>
                  </Button>
                </div>

                <pre class="max-h-[420px] overflow-auto whitespace-pre-wrap break-words rounded-ui border border-line bg-canvas p-3.5 font-mono text-xs leading-relaxed text-ink">{active === 'slack' ? slackOutput : markdownOutput}</pre>
              </div>
            </svelte:fragment>
          </Tabs>

          {#if !completeness.ready}
            <Notice tone="info" title="Async handoff tip">
              Adding {completeness.missing.join(' and ').toLowerCase()} saves a full day of back-and-forth across timezones.
            </Notice>
          {/if}
        </div>
      </Card>
    </aside>
  </main>

  <Toaster />
</div>
