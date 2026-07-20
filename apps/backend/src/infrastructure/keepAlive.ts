import axios from "axios";

// Render's free tier spins down after 15 min of zero incoming traffic.
// Pinging our own public URL periodically counts as real traffic and
// resets that clock — avoids needing an external cron service.
// Also pings the worker's URL, since keeping the worker warm matters
// just as much for the queue-consumer to stay responsive.
export function startKeepAlive() {
  if (process.env.NODE_ENV !== "production") return; // only needed on Render, not local dev

  const selfUrl = process.env.SELF_URL; // this service's own public URL
  const workerUrl = process.env.WORKER_URL; // the worker's public URL

  setInterval(async () => {
    try {
      if (selfUrl) await axios.get(`${selfUrl}/api/v1/health`);
      if (workerUrl) await axios.get(workerUrl);
    } catch (err) {
      console.error("Keep-alive ping failed:", (err as Error).message);
    }
  }, 10 * 60 * 1000); // every 10 minutes
}