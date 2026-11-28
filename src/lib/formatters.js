import { TRANSLATIONS } from './i18n.js';

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
    logs: '',
    attachmentUrls: ''
  };
}

function cleanSteps(steps) {
  return steps.map((s) => s.trim()).filter(Boolean);
}

function parseLinks(raw) {
  return (raw || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function getCompleteness(report, lang = 'en') {
  const names = (TRANSLATIONS[lang] || TRANSLATIONS.en).fieldNames;
  const checks = [
    { key: 'title', label: names.title, ok: report.title.trim().length > 0 },
    { key: 'steps', label: names.steps, ok: cleanSteps(report.steps).length > 0 },
    { key: 'expected', label: names.expected, ok: report.expected.trim().length > 0 },
    { key: 'actual', label: names.actual, ok: report.actual.trim().length > 0 }
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

export function buildMarkdown(report, attachedFiles = [], lang = 'en') {
  const t = (TRANSLATIONS[lang] || TRANSLATIONS.en).md;
  const title = report.title.trim() || t.untitled;
  const sev = report.severity.toUpperCase();
  const steps = cleanSteps(report.steps);
  const stepsText = steps.length
    ? steps.map((s, i) => `${i + 1}. ${s}`).join('\n')
    : t.noSteps;

  const envLines = [
    `- **${t.envField}:** ${report.environment}`,
    `- **${t.deviceField}:** ${report.device.trim() || '—'}`,
    `- **${t.reproField}:** ${report.reproducibility}`
  ];
  if (report.area.trim()) envLines.push(`- **${t.areaField}:** ${report.area.trim()}`);
  if (report.buildOrUrl.trim()) envLines.push(`- **${t.urlField}:** ${report.buildOrUrl.trim()}`);
  if (report.timezone.trim()) envLines.push(`- **${t.tzField}:** ${report.timezone.trim()}`);

  const sections = [
    `## [${sev}] ${title}`,
    '',
    `### ${t.steps}`,
    stepsText,
    '',
    `### ${t.expected}`,
    report.expected.trim() || t.notSpecified,
    '',
    `### ${t.actual}`,
    report.actual.trim() || t.notSpecified,
    '',
    `### ${t.env}`,
    envLines.join('\n')
  ];

  if (report.logs.trim()) {
    sections.push('', `### ${t.logs}`, '```', report.logs.trim(), '```');
  }

  const links = parseLinks(report.attachmentUrls);
  if (links.length || attachedFiles.length) {
    const attLines = [];
    links.forEach((url) => attLines.push(`- ${url}`));
    attachedFiles.forEach((f) => attLines.push(`- [ ] ${t.attachFile(f.name)}`));
    sections.push('', `### ${t.attachments}`, attLines.join('\n'));
  }

  return sections.join('\n');
}

export function buildSlackSummary(report, attachedFiles = [], lang = 'en') {
  const tMd = (TRANSLATIONS[lang] || TRANSLATIONS.en).md;
  const t = (TRANSLATIONS[lang] || TRANSLATIONS.en).slack;
  const title = report.title.trim() || tMd.untitled;
  const sev = report.severity.toUpperCase();
  const area = report.area.trim() ? ` · ${report.area.trim()}` : '';
  const steps = cleanSteps(report.steps);

  const lines = [
    `*[${sev}] ${title}*`,
    `_${report.environment}${area} · ${t.reproMeta}: ${report.reproducibility} · ${report.device.trim() || 'Browser'}_`,
    ''
  ];

  if (steps.length) {
    lines.push(`*${t.repro}*`);
    steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    lines.push('');
  }

  lines.push(`*${t.expected}* ${report.expected.trim() || '—'}`);
  lines.push(`*${t.actual}* ${report.actual.trim() || '—'}`);

  if (report.buildOrUrl.trim()) {
    lines.push(`*${t.context}* ${report.buildOrUrl.trim()}`);
  }
  if (report.logs.trim()) {
    lines.push('```', report.logs.trim(), '```');
  }

  const links = parseLinks(report.attachmentUrls);
  if (links.length || attachedFiles.length) {
    const items = [
      ...links,
      ...attachedFiles.map((f) => t.attachFile(f.name))
    ];
    lines.push(`*${t.attachments}* ${items.join(' | ')}`);
  }

  if (report.timezone.trim()) {
    lines.push(`_${t.tz(report.timezone.trim())}_`);
  }

  return lines.join('\n');
}

export function buildGitHubIssueUrl(report, repoSlug, lang = 'en') {
  const cleanRepo = (repoSlug || '').trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/+$/, '');
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(cleanRepo)) {
    return null;
  }
  const tMd = (TRANSLATIONS[lang] || TRANSLATIONS.en).md;
  const title = `[${report.severity.toUpperCase()}] ${report.title.trim() || tMd.untitled}`;
  const body = buildMarkdown(report, [], lang).slice(0, 6000);
  const params = new URLSearchParams({
    title,
    body,
    labels: 'bug'
  });
  return `https://github.com/${cleanRepo}/issues/new?${params.toString()}`;
}
