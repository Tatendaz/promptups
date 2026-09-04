// The page's half of the capability token.
//
// server.js injects <meta name="promptups-token"> into index.html as it serves
// it. A cross-origin page cannot read our HTML, so holding this value is proof
// the holder was served the page by the local server.
//
// Everything here is lazy and guarded: coach.js imports this module and is unit
// tested under node:test, where `document` does not exist. Reading the meta tag
// at module scope would break that suite on import.

export function token() {
  if (typeof document === "undefined") return "";
  return document.querySelector('meta[name="promptups-token"]')?.content || "";
}

// Merge the Authorization header into a fetch init's headers. Returns the extra
// headers unchanged when there is no token, so a page served by an older build
// degrades to the previous behaviour instead of sending `Bearer undefined`.
export function authHeaders(extra = {}) {
  const value = token();
  return value ? { ...extra, authorization: `Bearer ${value}` } : { ...extra };
}
