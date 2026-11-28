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
    REPO_OPTIONS,
    buildGitHubIssueUrl,
    buildMarkdown,
    buildSlackSummary,
    createEmptyReport,
    detectDeviceSummary,
    detectTimezone,
    getCompleteness
  } from './lib/formatters.js';
  import { LANG_KEY, TRANSLATIONS } from './lib/i18n.js';

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

  function loadInitialLang() {
    if (typeof window !== 'undefined') {
      const q = new URLSearchParams(window.location.search).get('lang')?.toLowerCase();
      if (q === 'ru' || q === 'en') return q;
    }
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved === 'ru' || saved === 'en') return saved;
    } catch {
      // Ignore storage errors
    }
    return 'en';
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
  let lang = loadInitialLang();
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-mode', mode);
    document.documentElement.setAttribute('lang', lang);
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

  $: t = TRANSLATIONS[lang] || TRANSLATIONS.en;

  $: {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(report));
    } catch {
      // Ignore storage quota issues
    }
  }

  $: targetRepo = selectedRepo === 'custom' ? customRepo : selectedRepo;
  $: githubIssueUrl = buildGitHubIssueUrl(report, targetRepo, lang);
  $: markdownOutput = buildMarkdown(report, attachedFiles, lang);
  $: slackOutput = buildSlackSummary(report, attachedFiles, lang);
  $: completeness = getCompleteness(report, lang);

  $: previewTabs = [
    { id: 'slack', label: t.tabSlack },
    { id: 'markdown', label: t.tabMarkdown }
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

  function toggleLang() {
    lang = lang === 'en' ? 'ru' : 'en';
    document.documentElement.setAttribute('lang', lang);
    try {
      localStorage.setItem(LANG_KEY, lang);
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
    const ex = t.example;
    report = {
      ...ex,
      steps: [...ex.steps]
    };
    toast({ title: t.toastExample, tone: 'info', duration: 2200 });
  }

  function resetForm() {
    report = createEmptyReport();
    attachedFiles = [];
    createdIssue = null;
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // Ignore storage failures
    }
    toast({ title: t.toastReset, duration: 1800 });
  }

  function autoDetectEnv() {
    report.device = detectDeviceSummary();
    report.timezone = detectTimezone();
    toast({ title: t.toastEnv, duration: 2000 });
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const comma = result.indexOf(',');
        resolve(comma >= 0 ? result.slice(comma + 1) : '');
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  async function prepareAttachments() {
    const MAX_SIZE = 2.5 * 1024 * 1024;
    const valid = [];
    for (const file of attachedFiles.slice(0, 4)) {
      if (file.size > MAX_SIZE) continue;
      const base64 = await readFileAsBase64(file);
      if (base64) {
        valid.push({ name: file.name, type: file.type, base64 });
      }
    }
    return valid;
  }

  async function submitTicket() {
    if (!githubIssueUrl) {
      toast({
        title: t.toastInvalidRepoTitle,
        description: t.toastInvalidRepoDesc,
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
        title: t.toastFillTitle,
        description: `${t.missingPrefix} ${completeness.missing.join(', ')}`,
        tone: 'warning',
        duration: 2800
      });
      return;
    }

    submitting = true;
    createdIssue = null;
    try {
      const attachments = await prepareAttachments();
      const res = await fetch(TICKETS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo: targetRepo,
          title: `[${report.severity.toUpperCase()}] ${report.title.trim()}`,
          body: markdownOutput,
          labels: ['bug'],
          attachments,
          website: honeypot
        })
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      createdIssue = { number: data.number, url: data.url };
      toast({
        title: t.ticketCreatedTitle(data.number),
        description: t.toastTicketCreatedDesc(targetRepo),
        tone: 'success',
        duration: 3500
      });
    } catch (err) {
      toast({
        title: t.toastFallbackTitle,
        description: err instanceof Error ? err.message : t.toastFallbackDesc,
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
        title: kind === 'slack' ? t.toastCopiedSlack : t.toastCopiedMd,
        description: completeness.ready
          ? t.toastCopiedReady
          : t.toastCopiedMissing(completeness.missing.join(', ')),
        tone: completeness.ready ? 'success' : 'warning',
        duration: 2800
      });
    } catch {
      toast({
        title: t.toastClipboardErrorTitle,
        description: t.toastClipboardErrorDesc,
        tone: 'danger',
        duration: 3200
      });
    }
  }
</script>

<div class="min-h-screen bg-canvas text-ink">
  <header class="sticky top-0 z-menu border-b border-line bg-canvas">
    <div class="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <h1 class="truncate text-sm font-semibold tracking-tight text-ink sm:text-lg">
            {t.appTitle}
          </h1>
          <span class="hidden sm:inline-flex">
            <Badge tone="neutral">{t.appBadge}</Badge>
          </span>
        </div>
        <p class="hidden text-xs text-ink-soft sm:block">
          {t.appSubtitle}
        </p>
      </div>

      <div class="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <Button variant="ghost" size="sm" on:click={loadExample}>
          <Sparkles class="h-3.5 w-3.5" />
          <span class="hidden sm:inline">{t.btnExample}</span>
        </Button>
        <Button variant="ghost" size="sm" on:click={resetForm} aria-label={t.btnReset}>
          <RotateCcw class="h-3.5 w-3.5" />
          <span class="hidden sm:inline">{t.btnReset}</span>
        </Button>
        <Button variant="secondary" size="sm" on:click={toggleLang} aria-label={t.toggleLangLabel}>
          <span class="font-mono text-xs">{lang === 'en' ? 'RU' : 'EN'}</span>
        </Button>
        <Button variant="secondary" size="sm" on:click={toggleMode} aria-label={t.toggleThemeLabel}>
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
              {t.sec1Title}
            </h2>
            <Badge tone={completeness.ready ? 'success' : 'warning'}>
              {t.coreFields(completeness.filled, completeness.total)}
            </Badge>
          </div>

          <TextField
            label={t.bugTitleLabel}
            required
            variant="boxed"
            placeholder={t.bugTitlePlaceholder}
            bind:value={report.title}
          />

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <span class="mb-1.5 block text-xs font-medium text-ink-soft">{t.severityLabel}</span>
              <SegmentedControl
                options={t.severityOptions}
                bind:value={report.severity}
                label={t.severityLabel}
                size="sm"
                full
              />
            </div>

            <div>
              <span class="mb-1.5 block text-xs font-medium text-ink-soft">{t.reproLabel}</span>
              <SegmentedControl
                options={t.reproOptions}
                bind:value={report.reproducibility}
                label={t.reproLabel}
                size="sm"
                full
              />
            </div>
          </div>

          <TextField
            label={t.areaLabel}
            variant="boxed"
            placeholder={t.areaPlaceholder}
            bind:value={report.area}
          />
        </div>
      </Card>

      <Card padding="lg">
        <div class="space-y-4">
          <div class="flex items-center justify-between gap-2">
            <div>
              <h2 class="text-sm font-semibold uppercase tracking-wider text-ink-soft">
                {t.sec2Title}
              </h2>
              <p class="mt-0.5 text-xs text-ink-faint">
                {t.sec2Hint}
              </p>
            </div>
            <Button variant="secondary" size="sm" on:click={addStep}>
              <Plus class="h-3.5 w-3.5" />
              <span>{t.addStep}</span>
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
                    variant="boxed"
                    size="sm"
                    placeholder={i === 0 ? t.stepPlaceholder0 : i === 1 ? t.stepPlaceholder1 : t.stepPlaceholderN}
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
                  aria-label={t.removeStepLabel(i + 1)}
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
            {t.sec3Title}
          </h2>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextArea
              class="min-w-0"
              label={t.expectedLabel}
              required
              variant="boxed"
              rows={4}
              placeholder={t.expectedPlaceholder}
              bind:value={report.expected}
            />

            <TextArea
              class="min-w-0"
              label={t.actualLabel}
              required
              variant="boxed"
              rows={4}
              placeholder={t.actualPlaceholder}
              bind:value={report.actual}
            />
          </div>
        </div>
      </Card>

      <Card padding="lg">
        <div class="space-y-4">
          <div class="flex items-center justify-between gap-2">
            <h2 class="text-sm font-semibold uppercase tracking-wider text-ink-soft">
              {t.sec4Title}
            </h2>
            <Button variant="ghost" size="sm" on:click={autoDetectEnv}>
              {t.autoDetect}
            </Button>
          </div>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField
              class="min-w-0"
              label={t.envLabel}
              variant="boxed"
              options={t.envOptions}
              bind:value={report.environment}
            />

            <TextField
              class="min-w-0"
              label={t.deviceLabel}
              variant="boxed"
              bind:value={report.device}
            />

            <TextField
              class="min-w-0"
              label={t.buildLabel}
              variant="boxed"
              placeholder={t.buildPlaceholder}
              bind:value={report.buildOrUrl}
            />

            <TextField
              class="min-w-0"
              label={t.timezoneLabel}
              variant="boxed"
              bind:value={report.timezone}
            />
          </div>

          <TextArea
            label={t.logsLabel}
            variant="boxed"
            rows={3}
            placeholder={t.logsPlaceholder}
            bind:value={report.logs}
          />
        </div>
      </Card>

      <Card padding="lg">
        <div class="space-y-4">
          <h2 class="text-sm font-semibold uppercase tracking-wider text-ink-soft">
            {t.sec5Title}
          </h2>

          <TextArea
            label={t.urlsLabel}
            variant="boxed"
            rows={2}
            placeholder={t.urlsPlaceholder}
            bind:value={report.attachmentUrls}
          />

          <FileUpload
            bind:files={attachedFiles}
            accept="image/*,video/*,.log,.txt,.json"
            label={t.uploadLabel}
            chooseLabel={t.uploadChoose}
            removeLabel={t.uploadRemove}
            hint={t.uploadHint}
          />
        </div>
      </Card>
    </section>

    <aside class="space-y-4 lg:sticky lg:top-20" aria-label="Shareable output">
      <Card padding="lg">
        <div class="space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="text-sm font-semibold uppercase tracking-wider text-ink-soft">
              {t.handoffTitle}
            </h2>
            {#if completeness.ready}
              <Badge tone="success">{t.asyncReady}</Badge>
            {:else}
              <Badge tone="warning">{t.missingPrefix} {completeness.missing.join(', ')}</Badge>
            {/if}
          </div>

          <div class="space-y-2.5 rounded-ui border border-line bg-canvas p-3">
            {#if showRepoPicker}
              <SelectField
                label={t.targetRepoLabel}
                variant="boxed"
                size="sm"
                options={REPO_OPTIONS}
                bind:value={selectedRepo}
              />
              {#if selectedRepo === 'custom'}
                <TextField
                  label={t.customRepoLabel}
                  variant="boxed"
                  size="sm"
                  placeholder="owner/repository"
                  bind:value={customRepo}
                />
              {/if}
            {:else}
              <div class="flex items-center justify-between gap-2 text-xs">
                <span class="text-ink-soft">
                  {t.filingInto} <strong class="font-mono text-ink">{targetRepo}</strong>
                </span>
                <Button variant="ghost" size="sm" on:click={() => (showRepoPicker = true)}>
                  {t.changeRepo}
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
              <span>{TICKETS_API_URL ? t.createTicket : t.createTicketGithub}</span>
            </Button>

            {#if createdIssue}
              <Notice tone="success" title={t.ticketCreatedTitle(createdIssue.number)}>
                <a
                  href={createdIssue.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="underline hover:opacity-80"
                >
                  {t.openIssueIn(targetRepo)}
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
                <span>{t.copiedSlack}</span>
              {:else}
                <MessageSquare class="h-3.5 w-3.5 shrink-0" />
                <span>{t.copySlack}</span>
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
                <span>{t.copiedMd}</span>
              {:else}
                <FileText class="h-3.5 w-3.5 shrink-0" />
                <span>{t.copyMarkdown}</span>
              {/if}
            </Button>
          </div>

          <Separator />

          <Tabs items={previewTabs} bind:value={previewTab} label="Output format">
            <svelte:fragment slot="panel" let:active>
              <div class="mt-3">
                <div class="mb-2 flex items-center justify-between">
                  <span class="text-xs text-ink-faint">
                    {active === 'slack' ? t.previewSlackHint : t.previewMdHint}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    on:click={() => copyText(active === 'slack' ? slackOutput : markdownOutput, active)}
                  >
                    <Copy class="h-3.5 w-3.5" />
                    <span>{t.copyBtn}</span>
                  </Button>
                </div>

                <pre class="max-h-[420px] overflow-auto whitespace-pre-wrap break-words rounded-ui border border-line bg-canvas p-3.5 font-mono text-xs leading-relaxed text-ink">{active === 'slack' ? slackOutput : markdownOutput}</pre>
              </div>
            </svelte:fragment>
          </Tabs>

          {#if !completeness.ready}
            <Notice tone="info" title={t.tipTitle}>
              {t.tipBody(completeness.missing.join(', ').toLowerCase())}
            </Notice>
          {/if}
        </div>
      </Card>
    </aside>
  </main>

  <Toaster />
</div>
