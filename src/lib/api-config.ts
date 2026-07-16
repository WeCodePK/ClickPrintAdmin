export function getApiHost() {
  const host = process.env.API_HOST?.replace(/\/$/, "");
  if (!host) {
    throw new Error(
      "API_HOST is not set. Add it to .env.local (e.g. API_HOST=https://your-api.com)",
    );
  }
  return host;
}

export function backendUrl(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${getApiHost()}${normalized}`;
}
