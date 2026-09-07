export function roomServiceOptions(endpoint = "") {
  if (!endpoint) return {};
  const url = new URL(endpoint);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error("Invalid room service configuration.");
  return {
    host: url.hostname,
    port: Number(url.port || 443),
    path: url.pathname.replace(/\/$/, "") || "/",
    secure: true,
  };
}
