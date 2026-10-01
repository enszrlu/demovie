export interface UrlCheck {
  ok: boolean;
  status: number | null;
  location: string | null;
  error: string | null;
}

/** Reachability probe: any 2xx/3xx answer counts as reachable (SPEC §9.1). */
export async function checkUrl(
  url: string,
  options: { timeoutMs?: number; headers?: Record<string, string> } = {},
): Promise<UrlCheck> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 5000);
  try {
    const res = await fetch(url, { redirect: "manual", signal: controller.signal, headers: options.headers });
    await res.body?.cancel().catch(() => {});
    return {
      ok: res.status >= 200 && res.status < 400,
      status: res.status,
      location: res.headers.get("location"),
      error: null,
    };
  } catch (error) {
    const cause = (error as { cause?: { code?: string } }).cause?.code;
    return { ok: false, status: null, location: null, error: cause ?? (error as Error).message };
  } finally {
    clearTimeout(timer);
  }
}

const LOCAL_HOSTS = /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$/i;
const PREVIEW_DOMAINS = [
  /\.vercel\.app$/i,
  /\.netlify\.app$/i,
  /\.pages\.dev$/i,
  /\.onrender\.com$/i,
  /\.fly\.dev$/i,
  /\.up\.railway\.app$/i,
];

/** Local and known preview hosts are safe to create demo data on (SPEC §9.1). */
export function isSafeAppUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return (
      LOCAL_HOSTS.test(host) ||
      host.endsWith(".localhost") ||
      host.endsWith(".test") ||
      PREVIEW_DOMAINS.some((re) => re.test(host))
    );
  } catch {
    return false;
  }
}

export function isLocalUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return LOCAL_HOSTS.test(host) || host.endsWith(".localhost");
  } catch {
    return false;
  }
}
