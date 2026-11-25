import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const locations = new Set(["wildwood", "castle"]);
const weapons = new Set(["ember", "frost", "starlight", "none yet"]);
const encoder = new TextEncoder();

type Score = {
  levels_completed: number;
  destroyed: number;
  shots: number;
};

class RequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function validateLocation(value: unknown): "wildwood" | "castle" {
  if (typeof value !== "string" || !locations.has(value)) {
    throw new RequestError(400, "Invalid location.");
  }
  return value as "wildwood" | "castle";
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new RequestError(400, "Request body must be valid JSON.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RequestError(400, "Request body must be a JSON object.");
  }
  return value as Record<string, unknown>;
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function bytesToHex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function signHmac(keyBytes: BufferSource, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", key, encoder.encode(message));
}

async function verifyTelegramInitData(initData: unknown, botToken: string) {
  if (typeof initData !== "string" || initData.length === 0 || initData.length > 10_000) {
    throw new RequestError(401, "Telegram authentication is required.");
  }
  const params = new URLSearchParams(initData);
  const suppliedHash = params.get("hash");
  const authDate = Number(params.get("auth_date"));
  const now = Math.floor(Date.now() / 1000);
  if (!suppliedHash || !Number.isInteger(authDate) || authDate > now + 60 || now - authDate > 86_400) {
    throw new RequestError(401, "Telegram authentication has expired.");
  }
  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = await signHmac(encoder.encode(botToken), "WebAppData");
  const calculatedHash = bytesToHex(await signHmac(secretKey, dataCheckString));
  if (suppliedHash.length !== calculatedHash.length) {
    throw new RequestError(401, "Telegram authentication is invalid.");
  }
  let mismatch = 0;
  for (let index = 0; index < calculatedHash.length; index += 1) {
    mismatch |= calculatedHash.charCodeAt(index) ^ suppliedHash.toLowerCase().charCodeAt(index);
  }
  if (mismatch !== 0) throw new RequestError(401, "Telegram authentication is invalid.");

  const rawUser = params.get("user");
  if (!rawUser) throw new RequestError(401, "Telegram user information is missing.");
  let user: Record<string, unknown>;
  try {
    user = JSON.parse(rawUser);
  } catch {
    throw new RequestError(401, "Telegram user information is invalid.");
  }
  if (!Number.isSafeInteger(user.id) || Number(user.id) <= 0) {
    throw new RequestError(401, "Telegram user information is invalid.");
  }
  return user;
}

function displayName(value: unknown, user: Record<string, unknown>) {
  const supplied = typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 24)
    : "";
  const telegramName = [user.first_name, user.last_name]
    .filter((part): part is string => typeof part === "string")
    .join(" ")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 24);
  return supplied || telegramName || `Dragon ${String(user.id).slice(-4)}`;
}

function isBetterScore(candidate: Score, current: Score) {
  return candidate.levels_completed > current.levels_completed
    || (candidate.levels_completed === current.levels_completed && candidate.destroyed > current.destroyed)
    || (candidate.levels_completed === current.levels_completed
      && candidate.destroyed === current.destroyed
      && candidate.shots < current.shots);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceRoleKey) throw new Error("Supabase server configuration is missing.");
    const supabase = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (request.method === "GET") {
      const location = validateLocation(new URL(request.url).searchParams.get("location") || "wildwood");
      const { data, error } = await supabase
        .from("global_scores")
        .select("display_name, levels_completed, destroyed, shots, weapon")
        .eq("location", location)
        .order("levels_completed", { ascending: false })
        .order("destroyed", { ascending: false })
        .order("shots", { ascending: true })
        .order("display_name", { ascending: true })
        .limit(5);
      if (error) throw error;
      return respond({
        entries: data.map((entry) => ({
          name: entry.display_name,
          levelsCompleted: entry.levels_completed,
          destroyed: entry.destroyed,
          shots: entry.shots,
          weapon: entry.weapon,
        })),
      });
    }

    if (request.method === "POST" || request.method === "PATCH") {
      const body = await readBody(request);
      const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
      if (!botToken) throw new Error("Telegram bot token is not configured on the server.");
      const user = await verifyTelegramInitData(body.initData, botToken);
      const name = displayName(body.name, user);
      const telegramUserId = Number(user.id);

      if (request.method === "PATCH") {
        const { error } = await supabase
          .from("global_scores")
          .update({ display_name: name, updated_at: new Date().toISOString() })
          .eq("telegram_user_id", telegramUserId);
        if (error) throw error;
        return respond({ updated: true });
      }

      const location = validateLocation(body.location);
      const levelsCompleted = body.levelsCompleted;
      const destroyed = body.destroyed;
      const shots = body.shots;
      if (!isIntegerInRange(levelsCompleted, 1, 1000)
        || !isIntegerInRange(destroyed, 0, 1_000_000)
        || !isIntegerInRange(shots, 0, 10_000_000)
        || typeof body.weapon !== "string" || !weapons.has(body.weapon)) {
        throw new RequestError(400, "Score data is invalid.");
      }
      const scoreFields: Score = {
        levels_completed: levelsCompleted,
        destroyed,
        shots,
      };
      const { data: current, error: readError } = await supabase
        .from("global_scores")
        .select("levels_completed, destroyed, shots, weapon")
        .eq("telegram_user_id", telegramUserId)
        .eq("location", location)
        .maybeSingle();
      if (readError) throw readError;
      const better = !current || isBetterScore(scoreFields, current);
      const record = current && !better
        ? {
          telegram_user_id: telegramUserId,
          location,
          display_name: name,
          levels_completed: current.levels_completed,
          destroyed: current.destroyed,
          shots: current.shots,
          weapon: current.weapon,
          updated_at: new Date().toISOString(),
        }
        : {
          telegram_user_id: telegramUserId,
          location,
          display_name: name,
          levels_completed: scoreFields.levels_completed,
          destroyed: scoreFields.destroyed,
          shots: scoreFields.shots,
          weapon: body.weapon,
          updated_at: new Date().toISOString(),
        };
      const { error: writeError } = await supabase
        .from("global_scores")
        .upsert(record, { onConflict: "telegram_user_id,location" });
      if (writeError) throw writeError;
      return respond({ saved: true, bestScoreUpdated: better });
    }

    return respond({ error: "Method not allowed." }, 405);
  } catch (error) {
    if (error instanceof RequestError) return respond({ error: error.message }, error.status);
    console.error("Global rating request failed.", error);
    return respond({ error: "Global rating is temporarily unavailable." }, 500);
  }
});
