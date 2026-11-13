// Cloudflare Worker (مجاني) = يخدم صفحة الـ Mini App + وسيط بين الصفحة والبوت.
// البوت بيسحب الطلبات منه (/_bot/poll) ويرجّع النتايج (/_bot/result)، فالبوت مش محتاج رابط عام.

const ACTIONS = new Set(["init", "stars", "binance", "vc_create", "vc_status", "vc_cancel", "cats", "ses_list", "del_sess", "countries", "buy_num", "get_code", "buy_ses", "orders", "track", "set_pref", "daily"]);

export class Relay {
  constructor() {
    this.queue = [];
    this.pollWaiters = [];
    this.results = new Map();      // id -> {result, t}
    this.resWaiters = new Map();   // id -> [resolve]
  }

  gc() {
    const now = Date.now();
    for (const [id, v] of this.results) if (now - v.t > 120000) this.results.delete(id);
    this.queue = this.queue.filter((i) => now - i.t < 120000);
  }

  wakePollers() {
    const w = this.pollWaiters.splice(0);
    w.forEach((f) => f());
  }

  waitResult(id, ms) {
    const got = this.results.get(id);
    if (got) return Promise.resolve(got.result);
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), ms);
      const list = this.resWaiters.get(id) || [];
      list.push((r) => { clearTimeout(timer); resolve(r); });
      this.resWaiters.set(id, list);
    });
  }

  async fetch(req) {
    this.gc();
    const url = new URL(req.url);
    const p = url.pathname;

    if (p === "/enqueue") {
      const body = await req.json();
      const id = crypto.randomUUID();
      this.queue.push({ id, action: body.action, init_data: body.init_data, params: body.params || {}, t: Date.now() });
      this.wakePollers();
      const res = await this.waitResult(id, 24000);
      return Response.json(res ? { status: "done", result: res } : { status: "pending", id });
    }

    if (p === "/result_get") {
      const id = url.searchParams.get("id") || "";
      const res = await this.waitResult(id, 20000);
      return Response.json(res ? { status: "done", result: res } : { status: "pending", id });
    }

    if (p === "/poll") {
      const wait = Math.min(parseInt(url.searchParams.get("wait") || "0", 10) || 0, 20000);
      if (!this.queue.length && wait > 0) {
        await new Promise((r) => {
          const t = setTimeout(r, wait);
          this.pollWaiters.push(() => { clearTimeout(t); r(); });
        });
      }
      const items = this.queue.splice(0, 20);
      return Response.json({ items });
    }

    if (p === "/result") {
      const body = await req.json();
      const id = String(body.id || "");
      if (id) {
        this.results.set(id, { result: body.result, t: Date.now() });
        const list = this.resWaiters.get(id) || [];
        this.resWaiters.delete(id);
        list.forEach((f) => f(body.result));
      }
      return Response.json({ ok: true });
    }
    return new Response("not found", { status: 404 });
  }
}

function secretOk(request, env) {
  const s = request.headers.get("X-Secret") || "";
  return !!env.WORKER_SECRET && s.length === env.WORKER_SECRET.length && s === env.WORKER_SECRET;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const relay = env.RELAY.get(env.RELAY.idFromName("main"));

    // ---- من البوت ----
    if (path === "/_bot/poll" || path === "/_bot/result") {
      if (!secretOk(request, env)) return new Response("unauthorized", { status: 401 });
      const target = path === "/_bot/poll" ? "/poll" : "/result";
      return relay.fetch("https://relay" + target + url.search, {
        method: request.method,
        body: request.method === "POST" ? await request.text() : undefined,
      });
    }

    // ---- من صفحة الـ Mini App ----
    if (path.startsWith("/api/")) {
      const headers = { "Cache-Control": "no-store" };
      if (request.method === "POST") {
        const action = path.slice(5);
        if (!ACTIONS.has(action)) return Response.json({ status: "error", error: "unknown_action" }, { status: 404, headers });
        const raw = await request.text();
        if (raw.length > 6000) return Response.json({ status: "error", error: "too_big" }, { status: 413, headers });
        let body;
        try { body = JSON.parse(raw); } catch { return Response.json({ status: "error", error: "bad_json" }, { status: 400, headers }); }
        if (typeof body.init_data !== "string" || !body.init_data) return Response.json({ status: "error", error: "auth" }, { status: 401, headers });
        const r = await relay.fetch("https://relay/enqueue", {
          method: "POST",
          body: JSON.stringify({ action, init_data: body.init_data, params: body.params && typeof body.params === "object" ? body.params : {} }),
        });
        return new Response(r.body, { status: 200, headers: { "Content-Type": "application/json", ...headers } });
      }
      if (request.method === "GET" && path.startsWith("/api/result/")) {
        const id = path.slice("/api/result/".length).slice(0, 64);
        const r = await relay.fetch("https://relay/result_get?id=" + encodeURIComponent(id));
        return new Response(r.body, { status: 200, headers: { "Content-Type": "application/json", ...headers } });
      }
      return new Response("not found", { status: 404 });
    }

    // ---- الصفحة نفسها ----
    return env.ASSETS.fetch(request);
  },
};
