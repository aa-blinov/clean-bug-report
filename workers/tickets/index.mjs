function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  };
}

function sanitizeFileName(name) {
  const base = String(name || 'file')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return base || 'attachment';
}

function isImageAttachment(name, type) {
  if (String(type || '').startsWith('image/')) return true;
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(name);
}

async function uploadAttachments(repo, attachments, token) {
  if (!Array.isArray(attachments) || !attachments.length) {
    return { uploaded: [], skipped: false };
  }

  const ym = new Date().toISOString().slice(0, 7);
  const uploaded = [];
  let skipped = false;

  for (const item of attachments.slice(0, 4)) {
    const rawName = String(item?.name || 'file');
    const safeName = sanitizeFileName(rawName);
    const base64 = String(item?.base64 || '').replace(/\s+/g, '');
    // ~2.5 MB binary -> ~3.4M base64 chars
    if (!base64 || base64.length > 3_600_000) continue;

    const uid = crypto.randomUUID().slice(0, 8);
    const path = `uploads/${ym}/${uid}-${safeName}`;

    const putRes = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'clean-bug-report-worker',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `Upload bug attachment ${safeName}`,
        content: base64,
        branch: 'attachments',
      }),
    });

    if (!putRes.ok) {
      skipped = true;
      continue;
    }

    const rawUrl = `https://raw.githubusercontent.com/${repo}/attachments/${path}`;
    const blobUrl = `https://github.com/${repo}/blob/attachments/${path}`;
    uploaded.push({
      name: rawName,
      markdown: isImageAttachment(safeName, item?.type)
        ? `![${rawName}](${rawUrl})`
        : `[${rawName}](${blobUrl})`,
    });
  }

  return { uploaded, skipped };
}

function injectUploadedAttachments(body, uploaded) {
  if (!uploaded.length) return body;
  let updated = body;

  for (const file of uploaded) {
    const escaped = file.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const checklistRe = new RegExp(`^- \\[ \\] [^\\n]*\`${escaped}\`$`, 'm');
    if (checklistRe.test(updated)) {
      updated = updated.replace(checklistRe, file.markdown);
    } else {
      updated += `\n${file.markdown}`;
    }
  }
  return updated;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const allowedOrigin = env.SITE_ORIGIN || 'https://aa-blinov.github.io';

    if (url.pathname !== '/tickets') {
      return new Response(null, { status: 404 });
    }
    if (!origin || origin !== allowedOrigin) {
      return new Response(JSON.stringify({ error: 'Forbidden origin' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const headers = corsHeaders(origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }
    if (request.method !== 'POST') {
      return new Response(null, { status: 405, headers: { ...headers, Allow: 'POST, OPTIONS' } });
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400, headers });
    }

    if (payload.website) {
      return Response.json({ ok: true, ignored: true }, { status: 200, headers });
    }

    const repo = String(payload.repo || '').trim();
    const allowedRepos = String(env.ALLOWED_REPOS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (!allowedRepos.includes(repo)) {
      return Response.json({ error: 'Repository is not in allowlist' }, { status: 400, headers });
    }

    const title = String(payload.title || '').trim().slice(0, 200);
    let body = String(payload.body || '').trim().slice(0, 16000);
    const labels = Array.isArray(payload.labels)
      ? payload.labels.map((l) => String(l).trim()).filter(Boolean).slice(0, 5)
      : ['bug'];

    if (!title || !body) {
      return Response.json({ error: 'Title and body are required' }, { status: 400, headers });
    }

    if (!env.GITHUB_TOKEN) {
      return Response.json({ error: 'Worker missing GITHUB_TOKEN secret' }, { status: 500, headers });
    }

    const { uploaded, skipped } = await uploadAttachments(repo, payload.attachments, env.GITHUB_TOKEN);
    body = injectUploadedAttachments(body, uploaded);

    const ghRes = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'clean-bug-report-worker',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, body, labels }),
    });

    if (!ghRes.ok) {
      const errText = await ghRes.text();
      return Response.json(
        { error: 'GitHub API rejected request', status: ghRes.status, detail: errText.slice(0, 300) },
        { status: 502, headers }
      );
    }

    const issue = await ghRes.json();
    return Response.json(
      {
        ok: true,
        number: issue.number,
        url: issue.html_url,
        attachmentsUploaded: uploaded.length,
        attachmentsSkipped: skipped,
      },
      { status: 201, headers }
    );
  },
};
