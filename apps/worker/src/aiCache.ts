import crypto from "crypto";

interface CacheEntry {
  response: string;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const TTL_MS = 10 * 60 * 1000; // 10 minutes

function hashPrompt(prompt: string): string {
  return crypto.createHash("sha256").update(prompt).digest("hex");
}

export function getCached(prompt: string): string | null {
  const key = hashPrompt(prompt);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.response;
}

export function setCached(prompt: string, response: string) {
  const key = hashPrompt(prompt);
  cache.set(key, { response, expiresAt: Date.now() + TTL_MS });
}