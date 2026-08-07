import client from "prom-client";

const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const httpRequestCounter = new client.Counter({
  name: "atlas_http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status"],
  registers: [register],
});

export const workflowRunCounter = new client.Counter({
  name: "atlas_workflow_runs_total",
  help: "Total workflow runs by final status",
  labelNames: ["status"],
  registers: [register],
});

export const httpRequestDuration = new client.Histogram({
  name: "atlas_http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route"],
  registers: [register],
});

export { register };