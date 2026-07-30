import dns from "dns/promises";
import net from "net";

const BLOCKED_HOSTNAMES = ["localhost", "0.0.0.0"];

function isPrivateIp(ip: string): boolean {
  if (net.isIP(ip) === 0) return true; // can't parse -> treat as unsafe
  const parts = ip.split(".").map(Number);
  if (ip === "127.0.0.1" || ip.startsWith("127.")) return true;
  if (parts[0] === 10) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 169 && parts[1] === 254) return true; // link-local + cloud metadata (169.254.169.254)
  if (ip === "::1") return true;
  return false;
}

export async function assertSafeUrl(rawUrl: string): Promise<void> {
  const url = new URL(rawUrl);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(`Blocked protocol: ${url.protocol}`);
  }
  if (BLOCKED_HOSTNAMES.includes(url.hostname)) {
    throw new Error(`Blocked hostname: ${url.hostname}`);
  }
  const { address } = await dns.lookup(url.hostname);
  if (isPrivateIp(address)) {
    throw new Error(`Blocked private/internal IP target: ${address}`);
  }
}