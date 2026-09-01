import { parseBearerToken, parseObservation } from "./validation";

type RuntimeEnv = Env & { RESEARCH_TOKEN?: string };

const securityHeaders = {
    "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
    "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
} as const;

const json = (data: unknown, status = 200) =>
    Response.json(data, {
        status,
        headers: { ...securityHeaders, "Cache-Control": "no-store" },
    });

const secure = (response: Response) => {
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(securityHeaders)) headers.set(name, value);
    if (response.status >= 400 && !headers.has("Cache-Control")) headers.set("Cache-Control", "no-store");
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
};

async function readLimitedJson(request: Request): Promise<unknown> {
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new Response("JSON is required.", { status: 415 });
    const declaredSize = Number(request.headers.get("content-length") ?? 0);
    if (declaredSize > 8_192) throw new Response("Request body is too large.", { status: 413 });

    const reader = request.body?.getReader();
    if (!reader) throw new Response("Request body is required.", { status: 400 });
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 8_192) {
            await reader.cancel();
            throw new Response("Request body is too large.", { status: 413 });
        }
        chunks.push(value);
    }

    const body = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
        body.set(chunk, offset);
        offset += chunk.byteLength;
    }
    try {
        return JSON.parse(new TextDecoder().decode(body));
    } catch {
        throw new Response("Malformed JSON.", { status: 400 });
    }
}

async function tokensMatch(provided: string, expected: string) {
    const encoder = new TextEncoder();
    const [providedHash, expectedHash] = await Promise.all([
        crypto.subtle.digest("SHA-256", encoder.encode(provided)),
        crypto.subtle.digest("SHA-256", encoder.encode(expected)),
    ]);
    return crypto.subtle.timingSafeEqual(providedHash, expectedHash);
}

async function authorize(request: Request, env: RuntimeEnv) {
    if (!env.RESEARCH_TOKEN) return json({ error: "Research actions are not configured." }, 503);
    const provided = parseBearerToken(request.headers.get("authorization"));
    return provided && (await tokensMatch(provided, env.RESEARCH_TOKEN)) ? null : json({ error: "Invalid research access key." }, 401);
}

async function dashboard(env: RuntimeEnv) {
    const [metadata, outcomes, observations, observationSummary] = await env.DB.batch([
        env.DB.prepare(`
            SELECT
                (SELECT COUNT(*) FROM participants WHERE enrollment_status = 'active') AS participants,
                (SELECT COUNT(*) FROM survey_responses WHERE round_id = 'synthetic_pilot') AS completed_surveys,
                (SELECT COUNT(*) FROM observations WHERE status != 'closed') AS open_observations,
                (SELECT COUNT(*) FROM study_arms) AS study_arms
        `),
        env.DB.prepare(`
            SELECT a.slug AS arm, a.name AS arm_name, r.slug AS round, r.name AS round_name,
                COUNT(s.id) AS responses,
                ROUND(AVG(s.household_income_rwf)) AS income,
                ROUND(AVG(s.savings_rwf)) AS savings,
                ROUND(AVG(s.food_security_score), 1) AS food_security,
                ROUND(AVG(s.forest_visits_30d), 1) AS forest_visits,
                ROUND(AVG(s.firewood_trips_30d), 1) AS firewood_trips,
                ROUND(AVG(s.alternative_livelihood) * 100, 1) AS alternative_livelihood_rate
            FROM survey_responses s
            JOIN participants p ON p.id = s.participant_id
            JOIN study_arms a ON a.id = p.arm_id
            JOIN survey_rounds r ON r.id = s.round_id
            GROUP BY a.id, r.id
            ORDER BY r.sequence, a.sequence
        `),
        env.DB.prepare(`
            SELECT id, sector, type, severity, status, observed_at
            FROM observations ORDER BY observed_at DESC, created_at DESC LIMIT 8
        `),
        env.DB.prepare(`
            SELECT type, COUNT(*) AS total, SUM(CASE WHEN status != 'closed' THEN 1 ELSE 0 END) AS open
            FROM observations GROUP BY type ORDER BY total DESC
        `),
    ]);

    return json({
        notice: "Synthetic demonstration data — not findings from the Nyungwe RCT.",
        metadata: metadata.results[0],
        outcomes: outcomes.results,
        observations: observations.results,
        observationSummary: observationSummary.results,
        updatedAt: new Date().toISOString(),
    });
}

async function createObservation(request: Request, env: RuntimeEnv) {
    const unauthorized = await authorize(request, env);
    if (unauthorized) return unauthorized;
    const parsed = parseObservation(await readLimitedJson(request));
    if (!parsed.ok) return json({ error: parsed.error }, 422);

    const id = crypto.randomUUID();
    const value = parsed.value;
    const row = await env.DB.prepare(`
        INSERT INTO observations (id, sector, type, severity, observed_at, notes)
        VALUES (?, ?, ?, ?, ?, ?) RETURNING id, sector, type, severity, status, observed_at, notes
    `)
        .bind(id, value.sector, value.type, value.severity, value.observedAt, value.notes)
        .first();

    console.log(JSON.stringify({ event: "observation_created", observationId: id, sector: value.sector, severity: value.severity }));
    return json({ observation: row }, 201);
}

async function exportCsv(env: RuntimeEnv) {
    const result = await env.DB.prepare(`
        SELECT a.name AS study_arm, r.name AS survey_round, COUNT(s.id) AS responses,
            ROUND(AVG(s.household_income_rwf)) AS average_income_rwf,
            ROUND(AVG(s.savings_rwf)) AS average_savings_rwf,
            ROUND(AVG(s.food_security_score), 1) AS food_security_score,
            ROUND(AVG(s.forest_visits_30d), 1) AS forest_visits_30d,
            ROUND(AVG(s.firewood_trips_30d), 1) AS firewood_trips_30d,
            ROUND(AVG(s.alternative_livelihood) * 100, 1) AS alternative_livelihood_percent
        FROM survey_responses s
        JOIN participants p ON p.id = s.participant_id
        JOIN study_arms a ON a.id = p.arm_id
        JOIN survey_rounds r ON r.id = s.round_id
        GROUP BY a.id, r.id ORDER BY r.sequence, a.sequence
    `).all();
    const columns = ["study_arm", "survey_round", "responses", "average_income_rwf", "average_savings_rwf", "food_security_score", "forest_visits_30d", "firewood_trips_30d", "alternative_livelihood_percent"];
    const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const body = [columns.join(","), ...result.results.map((row) => columns.map((column) => escape(row[column])).join(","))].join("\n");
    return new Response(body, {
        headers: {
            ...securityHeaders,
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": 'attachment; filename="nyungwe-nexus-aggregate-demo.csv"',
        },
    });
}

async function api(request: Request, env: RuntimeEnv) {
    const { pathname } = new URL(request.url);
    if (request.method === "GET" && pathname === "/api/health") return json({ status: "ok" });
    if (request.method === "GET" && pathname === "/api/dashboard") return dashboard(env);
    if (request.method === "GET" && pathname === "/api/export.csv") return exportCsv(env);
    if (request.method === "POST" && pathname === "/api/observations") return createObservation(request, env);
    return json({ error: "Not found." }, 404);
}

export default {
    async fetch(request, env): Promise<Response> {
        const url = new URL(request.url);
        try {
            if (url.pathname.startsWith("/api/")) return await api(request, env);
            return secure(await env.ASSETS.fetch(request));
        } catch (error) {
            if (error instanceof Response) return secure(error);
            console.error(JSON.stringify({ event: "request_failed", path: url.pathname, error: error instanceof Error ? error.message : String(error) }));
            return json({ error: "Unexpected server error." }, 500);
        }
    },
} satisfies ExportedHandler<RuntimeEnv>;
