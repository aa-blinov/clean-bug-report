export const SEVERITY_OPTIONS = [
  { value: 'blocker', label: 'Blocker' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' }
];

export const REPRO_RATE_OPTIONS = [
  { value: 'always', label: 'Always' },
  { value: 'intermittent', label: 'Intermittent' },
  { value: 'once', label: 'Once' }
];

export const ENV_OPTIONS = [
  { value: 'Production', label: 'Production' },
  { value: 'Staging', label: 'Staging' },
  { value: 'Preview / PR', label: 'Preview / PR' },
  { value: 'Local', label: 'Local' }
];

export const REPO_OPTIONS = [
  { value: 'aa-blinov/clean-bug-report', label: 'aa-blinov/clean-bug-report' },
  { value: 'aa-blinov/cast', label: 'aa-blinov/cast' },
  { value: 'aa-blinov/lazy-to-text', label: 'aa-blinov/lazy-to-text' },
  { value: 'aa-blinov/petzy', label: 'aa-blinov/petzy' },
  { value: 'aa-blinov/cronator', label: 'aa-blinov/cronator' },
  { value: 'aa-blinov/bitrix-flow', label: 'aa-blinov/bitrix-flow' },
  { value: 'aa-blinov/precision-block-stack', label: 'aa-blinov/precision-block-stack' },
  { value: 'custom', label: 'Custom owner/repo...' }
];

export function detectTimezone() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local';
    const offsetMin = -new Date().getTimezoneOffset();
    const sign = offsetMin >= 0 ? '+' : '-';
    const absH = Math.floor(Math.abs(offsetMin) / 60);
    const absM = Math.abs(offsetMin) % 60;
    const offset = absM ? `UTC${sign}${absH}:${String(absM).padStart(2, '0')}` : `UTC${sign}${absH}`;
    return `${offset} (${tz})`;
  } catch {
    return 'UTC';
  }
}

export function detectDeviceSummary() {
  if (typeof navigator === 'undefined') return 'Desktop Browser';
  const ua = navigator.userAgent;
  let browser = 'Browser';
  if (ua.includes('Firefox/')) browser = 'Firefox';
  else if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('Chrome/')) browser = 'Chrome';
  else if (ua.includes('Safari/')) browser = 'Safari';

  let os = 'OS';
  if (ua.includes('Mac OS X')) os = 'macOS';
  else if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Linux')) os = 'Linux';

  const vp = typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : '';
  return vp ? `${browser} on ${os} (${vp})` : `${browser} on ${os}`;
}

export function createEmptyReport() {
  return {
    title: '',
    severity: 'high',
    area: '',
    reproducibility: 'always',
    steps: ['', '', ''],
    expected: '',
    actual: '',
    environment: 'Production',
    device: detectDeviceSummary(),
    timezone: detectTimezone(),
    buildOrUrl: '',
    logs: ''
  };
}

export const EXAMPLE_REPORT = {
  title: 'Checkout button stays disabled after applying 100% promo code',
  severity: 'high',
  area: 'Billing / Checkout',
  reproducibility: 'always',
  steps: [
    'Open /checkout with any paid plan in cart',
    'Enter promo code TEAMFREE100 and click Apply',
    'Observe total drops to $0.00, then click Complete Order'
  ],
  expected: 'Order completes immediately without requesting card details when total is $0.00.',
  actual: 'Complete Order button remains disabled and console logs "paymentIntent.amount must be >= 50".',
  environment: 'Production',
  device: 'Chrome on macOS (1440x900)',
  timezone: 'UTC+5 (Asia/Almaty)',
  buildOrUrl: 'https://app.example.com/checkout (v2.14.3)',
  logs: 'Error: paymentIntent.amount must be >= 50\n  at createIntent (checkout.ts:142)'
};

function cleanSteps(steps) {
  return steps.map((s) => s.trim()).filter(Boolean);
}

export function getCompleteness(report) {
  const checks = [
    { key: 'title', label: 'Title', ok: report.title.trim().length > 0 },
    { key: 'steps', label: 'Repro steps', ok: cleanSteps(report.steps).length > 0 },
    { key: 'expected', label: 'Expected', ok: report.expected.trim().length > 0 },
    { key: 'actual', label: 'Actual', ok: report.actual.trim().length > 0 }
  ];
  const filled = checks.filter((c) => c.ok).length;
  const missing = checks.filter((c) => !c.ok).map((c) => c.label);
  return {
    filled,
    total: checks.length,
    missing,
    ready: missing.length === 0
  };
}

export function buildMarkdown(report) {
  const title = report.title.trim() || 'Untitled bug report';
  const sev = report.severity.toUpperCase();
  const steps = cleanSteps(report.steps);
  const stepsText = steps.length
    ? steps.map((s, i) => `${i + 1}. ${s}`).join('\n')
    : '1. _No steps provided_';

  const envLines = [
    `- **Environment:** ${report.environment}`,
    `- **Device / Viewport:** ${report.device.trim() || 'Not specified'}`,
    `- **Reproducibility:** ${report.reproducibility}`
  ];
  if (report.area.trim()) envLines.push(`- **Area:** ${report.area.trim()}`);
  if (report.buildOrUrl.trim()) envLines.push(`- **URL / Build:** ${report.buildOrUrl.trim()}`);
  if (report.timezone.trim()) envLines.push(`- **Reporter TZ:** ${report.timezone.trim()}`);

  const sections = [
    `## [${sev}] ${title}`,
    '',
    '### Steps to Reproduce',
    stepsText,
    '',
    '### Expected Behavior',
    report.expected.trim() || '_Not specified_',
    '',
    '### Actual Behavior',
    report.actual.trim() || '_Not specified_',
    '',
    '### Environment',
    envLines.join('\n')
  ];

  if (report.logs.trim()) {
    sections.push('', '### Logs / Error', '```', report.logs.trim(), '```');
  }

  return sections.join('\n');
}

export function buildSlackSummary(report) {
  const title = report.title.trim() || 'Untitled bug report';
  const sev = report.severity.toUpperCase();
  const area = report.area.trim() ? ` · ${report.area.trim()}` : '';
  const steps = cleanSteps(report.steps);

  const lines = [
    `*[${sev}] ${title}*`,
    `_${report.environment}${area} · Repro: ${report.reproducibility} · ${report.device.trim() || 'Browser'}_`,
    ''
  ];

  if (steps.length) {
    lines.push('*Repro:*');
    steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    lines.push('');
  }

  lines.push(`*Expected:* ${report.expected.trim() || '—'}`);
  lines.push(`*Actual:* ${report.actual.trim() || '—'}`);

  if (report.buildOrUrl.trim()) {
    lines.push(`*Context:* ${report.buildOrUrl.trim()}`);
  }
  if (report.logs.trim()) {
    lines.push('```', report.logs.trim(), '```');
  }
  if (report.timezone.trim()) {
    lines.push(`_Async reporter TZ: ${report.timezone.trim()}_`);
  }

  return lines.join('\n');
}

export function buildGitHubIssueUrl(report, repoSlug) {
  const cleanRepo = (repoSlug || '').trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/+$/, '');
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(cleanRepo)) {
    return null;
  }
  const title = `[${report.severity.toUpperCase()}] ${report.title.trim() || 'Bug report'}`;
  const body = buildMarkdown(report).slice(0, 6000);
  const params = new URLSearchParams({
    title,
    body,
    labels: 'bug'
  });
  return `https://github.com/${cleanRepo}/issues/new?${params.toString()}`;
}
