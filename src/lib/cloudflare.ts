import { getDb } from "@/lib/db";

type CfPurgeResponse = {
  success?: boolean;
  errors?: Array<{ code: number; message: string }>;
  result?: { id: string };
};

export type CloudflareCreds = {
  apiToken: string;
  zoneId: string;
};

export async function getCloudflareCreds(clientId: number): Promise<CloudflareCreds | null> {
  const sql = getDb();
  const rows = (await sql`
    SELECT cloudflare_api_token, cloudflare_zone_id
    FROM site_settings WHERE client_id = ${clientId} LIMIT 1
  `) as Array<{ cloudflare_api_token: string | null; cloudflare_zone_id: string | null }>;
  const row = rows[0];
  if (!row?.cloudflare_api_token || !row?.cloudflare_zone_id) return null;
  return { apiToken: row.cloudflare_api_token, zoneId: row.cloudflare_zone_id };
}

export type PurgeOptions = { everything?: boolean; files?: string[] };

export async function purgeCloudflare(
  creds: CloudflareCreds,
  opts: PurgeOptions = { everything: true }
): Promise<{ ok: boolean; errors: string[] }> {
  const body: Record<string, unknown> = opts.everything
    ? { purge_everything: true }
    : { files: opts.files ?? [] };
  let res: Response;
  try {
    res = await fetch(`https://api.cloudflare.com/client/v4/zones/${creds.zoneId}/purge_cache`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return { ok: false, errors: [err instanceof Error ? err.message : String(err)] };
  }
  let json: CfPurgeResponse | null = null;
  try {
    json = (await res.json()) as CfPurgeResponse;
  } catch {
    return { ok: false, errors: [`Cloudflare returned ${res.status} (non-JSON response)`] };
  }
  if (res.ok && json?.success) return { ok: true, errors: [] };
  return { ok: false, errors: (json?.errors ?? []).map((e) => `${e.code}: ${e.message}`) };
}

/**
 * Verifies a token + zone by hitting the zone read endpoint.
 */
export async function verifyCloudflare(creds: CloudflareCreds): Promise<{ ok: boolean; name?: string; error?: string }> {
  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${creds.zoneId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${creds.apiToken}` },
    });
    const json = (await res.json()) as { success?: boolean; result?: { name?: string }; errors?: Array<{ message: string }> };
    if (res.ok && json?.success && json.result?.name) return { ok: true, name: json.result.name };
    return { ok: false, error: (json.errors?.[0]?.message) || `Cloudflare returned ${res.status}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
