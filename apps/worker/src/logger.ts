type Level = "info" | "warn" | "error";
function log(level: Level, message: string, meta?: Record<string, unknown>) {
  console.log(JSON.stringify({ level, message, ...meta, timestamp: new Date().toISOString() }));
}
export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => log("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log("error", message, meta),
};