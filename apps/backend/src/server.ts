import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";

import { doubleCsrfProtection, generateCsrfToken } from "./interfaces/http/middleware/csrf";
import { errorHandler } from "./interfaces/http/middleware/errorHandler";
import passport from "./infrastructure/auth/passport";
import { initSocketServer } from "./infrastructure/realtime/socketServer";
// import { startKeepAlive } from "./infrastructure/keepAlive";

import healthRouter from "./interfaces/http/routes/health";
import authRouter from "./interfaces/http/routes/auth";
import organizationsRouter from "./interfaces/http/routes/organizations";
import workflowsRouter from "./interfaces/http/routes/workflows";
import formsRouter from "./interfaces/http/routes/forms";
import rulesRouter from "./interfaces/http/routes/rules";
import auditRouter from "./interfaces/http/routes/audit";
import analyticsRouter from "./interfaces/http/routes/analytics";
import filesRouter from "./interfaces/http/routes/files";
import apiKeysRouter from "./interfaces/http/routes/apiKeys";
import featureFlagsRouter from "./interfaces/http/routes/featureFlags";
import searchRouter from "./interfaces/http/routes/search";
import notificationsRouter from "./interfaces/http/routes/notifications";
import internalRouter from "./interfaces/http/routes/internal";
import webhooksRouter from "./interfaces/http/routes/webhooks";
import publicApiRouter from "./interfaces/http/routes/publicApi";
import swaggerUi from "swagger-ui-express";
import openapiSpec from "./openapi.json";
import { loadScheduledWorkflows } from "./infrastructure/scheduler/cronScheduler";
import aiWorkflowRouter from "./interfaces/http/routes/aiWorkflow";
import { register, httpRequestCounter, httpRequestDuration } from "./infrastructure/metrics/metrics";

const app = express();
app.set("trust proxy", 1);

// 1. Security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", process.env.FRONTEND_URL || "http://localhost:5173"],
      },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// 2. CORS
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173", credentials: true }));

// 3. Body/cookie parsing
app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));

// 4. Global rate limit
app.use("/api/v1", rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));

// 5. Metrics - placed before CSRF so a scraper never needs to touch
// CSRF logic at all (harmless either way since GETs are exempt, but
// this keeps monitoring fully decoupled from the auth/CSRF pipeline).
app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on("finish", () => {
    const route = req.route?.path || req.path;
    httpRequestCounter.inc({ method: req.method, route, status: res.statusCode });
    end({ method: req.method, route });
  });
  next();
});
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

// 6. CSRF token issuance - public, must exist before protection is enforced
app.get("/api/v1/csrf-token", (req, res) => {
  res.json({ csrfToken: generateCsrfToken(req, res) });
});

// 7. CSRF protection - runs BEFORE every router, on every mutating request, except the auth entry points that can't have a token yet.
app.use((req, res, next) => {
  const exempt =
    req.method === "GET" ||
    ["/api/v1/auth/login", "/api/v1/auth/register", "/api/v1/auth/refresh", "/api/v1/auth/logout"].includes(req.path) ||
    req.path.startsWith("/api/v1/auth/google") ||
    req.path.startsWith("/api/v1/auth/github") ||
    req.path.startsWith("/api/v1/internal") ||
    req.path.startsWith("/api/v1/webhooks") ||
    req.path.startsWith("/api/v1/ai/stream-test") ||
    req.path.startsWith("/api/v1/public");
  if (exempt) return next();
  return doubleCsrfProtection(req, res, next);
});

app.use(passport.initialize());

// 8. Routers - mounted AFTER CSRF protection is active
app.use("/api/v1", healthRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1", organizationsRouter);
app.use("/api/v1", workflowsRouter);
app.use("/api/v1", formsRouter);
app.use("/api/v1", rulesRouter);
app.use("/api/v1", auditRouter);
app.use("/api/v1", analyticsRouter);
app.use("/api/v1", filesRouter);
app.use("/api/v1", apiKeysRouter);
app.use("/api/v1", featureFlagsRouter);
app.use("/api/v1", searchRouter);
app.use("/api/v1", notificationsRouter);
app.use("/api/v1", internalRouter);
app.use("/api/v1", webhooksRouter);
app.use("/api/v1", publicApiRouter);
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));
app.use("/api/v1", aiWorkflowRouter);

// 9. 404 for anything unmatched
app.use((req, res) => res.status(404).json({ error: "Not found" }));

// 10. Error handler - MUST be last, 4-arg signature
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
initSocketServer(server);
// startKeepAlive();
loadScheduledWorkflows();