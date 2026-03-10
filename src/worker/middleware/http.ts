export function shouldSkipApiRequestLog(path: string): boolean {
  return (
    path === "/api/stream/metrics" ||
    path === "/api/stream/alerts" ||
    path === "/api/v1/stream/metrics" ||
    path === "/api/v1/stream/alerts"
  );
}

export function applyDefaultSecurityHeaders(headers: Headers, secureTransport: boolean): void {
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set(
    "Permissions-Policy",
    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), microphone=(), payment=(), usb=()"
  );

  if (secureTransport) {
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
}
