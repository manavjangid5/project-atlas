import axios from "axios";

export function startKeepAlive() {
  if (process.env.NODE_ENV !== "production") return;

  const selfUrl = process.env.SELF_URL;
  const backendUrl = process.env.BACKEND_URL; // already exists in your worker's env

  setInterval(async () => {
    try {
      if (selfUrl) await axios.get(selfUrl);
      if (backendUrl) await axios.get(`${backendUrl}/api/v1/health`);
    } catch (err) {
      console.error("Keep-alive ping failed:", (err as Error).message);
    }
  }, 10 * 60 * 1000);
}