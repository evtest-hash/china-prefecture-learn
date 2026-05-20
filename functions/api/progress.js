const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_ITEMS = 400;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const id = url.searchParams.get("id");

  if (!id || !UUID_RE.test(id)) {
    return json({ error: "Invalid ID" }, 400);
  }

  try {
    const data = await context.env.PROGRESS.get(id, "json");
    return json(data || { learned: [], updatedAt: null });
  } catch {
    return json({ error: "KV read failed" }, 500);
  }
}

export async function onRequestPut(context) {
  const url = new URL(context.request.url);
  const id = url.searchParams.get("id");

  if (!id || !UUID_RE.test(id)) {
    return json({ error: "Invalid ID" }, 400);
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (!Array.isArray(body.learned) || body.learned.length > MAX_ITEMS) {
    return json({ error: "Invalid data" }, 400);
  }

  const updatedAt = new Date().toISOString();

  try {
    await context.env.PROGRESS.put(
      id,
      JSON.stringify({ learned: body.learned, updatedAt }),
    );
    return json({ ok: true, updatedAt });
  } catch {
    return json({ error: "KV write failed" }, 500);
  }
}
