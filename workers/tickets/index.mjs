function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  };
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

    // Honeypot anti-spam field
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
    const body = String(payload.body || '').trim().slice(0, 16000);
    const labels = Array.isArray(payload.labels)
      ? payload.labels.map((l) => String(l).trim()).filter(Boolean).slice(0, 5)
      : ['bug'];

    if (!title || !body) {
      return Response.json({ error: 'Title and body are required' }, { status: 400, headers });
    }

    if (!env.GITHUB_TOKEN) {
      return Response.json({ error: 'Worker missing GITHUB_TOKEN secret' }, { status: 500, headers });
    }

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
      { ok: true, number: issue.number, url: issue.html_url },
      { status: 201, headers }
    );
  },
};
