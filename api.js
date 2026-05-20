const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_ITEMS = 400;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/progress") {
      return handleProgress(request, env, url);
    }

    return env.ASSETS.fetch(request);
  },
};

async function handleProgress(request, env, url) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const id = url.searchParams.get("id");
  if (!id || !UUID_RE.test(id)) {
    return json({ error: "Invalid ID" }, 400);
  }

  if (request.method === "GET") {
    try {
      const data = await env.PROGRESS.get(id, "json");
      return json(data || { learned: [], updatedAt: null });
    } catch {
      return json({ error: "KV read failed" }, 500);
    }
  }

  if (request.method === "PUT") {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    if (!Array.isArray(body.learned) || body.learned.length > MAX_ITEMS) {
      return json({ error: "Invalid data" }, 400);
    }

    const updatedAt = new Date().toISOString();
    try {
      await env.PROGRESS.put(id, JSON.stringify({ learned: body.learned, updatedAt }));
      return json({ ok: true, updatedAt });
    } catch {
      return json({ error: "KV write failed" }, 500);
    }
  }

  return json({ error: "Method not allowed" }, 405);
}
