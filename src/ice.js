export const DEFAULT_ICE = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

export function hasRelay(config) {
  return (
    config?.iceServers?.some((server) =>
      [server.urls].flat().some((url) => /^turns?:/.test(url)),
    ) ?? false
  );
}

function cleanServers(value) {
  const servers = Array.isArray(value) ? value : value?.iceServers;
  if (!Array.isArray(servers) || !servers.length || servers.length > 16)
    throw new Error("Invalid relay configuration");
  return servers.map((server) => {
    const urls = [server?.urls].flat();
    if (
      !urls.length ||
      urls.length > 8 ||
      urls.some(
        (url) =>
          typeof url !== "string" ||
          url.length > 512 ||
          !/^(stun|stuns|turn|turns):[a-zA-Z0-9.[\]:-]+(?:\?transport=(udp|tcp))?$/.test(
            url,
          ),
      )
    )
      throw new Error("Invalid relay address");
    const turn = urls.some((url) => /^turns?:/.test(url));
    if (
      turn &&
      [server.username, server.credential].some(
        (text) =>
          typeof text !== "string" || !text.length || text.length > 4096,
      )
    )
      throw new Error("Missing relay credentials");
    return {
      urls,
      ...(turn
        ? { username: server.username, credential: server.credential }
        : {}),
    };
  });
}

// The URL must expose only client-scoped TURN credentials. Account secrets must
// stay on the provider or a backend, never in the static game build.
export async function loadIceConfig(endpoint, fetcher = globalThis.fetch) {
  if (!endpoint) return { iceServers: DEFAULT_ICE };
  try {
    const url = new URL(endpoint);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      [...url.searchParams.keys()].some((key) => /secret/i.test(key))
    )
      throw new Error("Invalid relay endpoint");
    const response = await fetcher(url.href, {
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
    if (!response.ok) throw new Error("Relay service unavailable");
    const config = {
      iceServers: [...DEFAULT_ICE, ...cleanServers(await response.json())],
    };
    if (!hasRelay(config)) throw new Error("No relay servers returned");
    return config;
  } catch {
    // Do not include provider responses or credential URLs in player-facing errors.
    throw new Error(
      "The game's relay service is unavailable. Try again shortly.",
    );
  }
}

export function connectionFailure(config, connection) {
  if (connection?.open)
    return "The connection opened, but the room response did not arrive. Check the connection details.";
  if (
    ["connected", "completed"].includes(
      connection?.peerConnection?.iceConnectionState,
    )
  )
    return "The network connection succeeded, but the game data channel did not open. Check the connection details.";
  return hasRelay(config)
    ? "The host responded, but connection negotiation did not finish. A relay is configured; check the connection details."
    : "The host responded, but connection negotiation did not finish. No relay is configured; the cause is not yet known.";
}
