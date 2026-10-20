export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    throw new Error(
      'JWT_SECRET is required. Generate a random secret and set it in the root .env file before starting the API.',
    );
  }
  return secret;
}
