import { DemovieError } from "@demovie/core";

/**
 * Map a provider HTTP failure to a DemovieError with a fix hint. Never includes the API key; the response body is
 * truncated because providers sometimes echo the request.
 */
export async function providerError(label: string, envKey: string, res: Response, what: string): Promise<DemovieError> {
  let body = "";
  try {
    body = (await res.text()).replace(/\s+/g, " ").trim().slice(0, 240);
  } catch {
    // ignore unreadable bodies
  }
  const detail = `${label} ${what} failed: HTTP ${res.status}${body ? ` — ${body}` : ""}`;
  if (res.status === 401 || res.status === 403)
    return new DemovieError(
      "E_PROVIDER",
      detail,
      `check ${envKey} (set it in your environment or .demovie/.env) and that your ${label} plan allows this`,
    );
  if (res.status === 429)
    return new DemovieError("E_PROVIDER", detail, `${label} rate-limited the request; wait a minute and re-run`);
  if (res.status === 400 || res.status === 404 || res.status === 422)
    return new DemovieError("E_PROVIDER", detail, "check --voice and --model (or audio.voice in .demovie/config.json)");
  return new DemovieError("E_PROVIDER", detail, `retry later; ${label} returned a server error`);
}
