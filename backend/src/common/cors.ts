export function allowedOrigins(): string[] {
  return (process.env.FRONTEND_URL || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function isAllowedOrigin(origin: string | undefined): boolean {
  return !origin || allowedOrigins().includes(origin);
}
