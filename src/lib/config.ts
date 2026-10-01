export function mustEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export function env(name: string, fallback = ""): string {
  return process.env[name] || fallback;
}

export function appUrl(): string {
  return env("APP_URL", "http://localhost:3000").replace(/\/$/, "");
}
