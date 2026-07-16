import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
dotenv.config();
import healthRouter from "./interfaces/http/routes/health";
import { errorHandler } from "./interfaces/http/middleware/errorHandler";

import passport from "./infrastructure/auth/passport";
import authRouter from "./interfaces/http/routes/auth";
import organizationsRouter from "./interfaces/http/routes/organizations";
import workflowsRouter from "./interfaces/http/routes/workflows";
import auditRouter from "./interfaces/http/routes/audit";
import formsRouter from "./interfaces/http/routes/forms";
import rulesRouter from "./interfaces/http/routes/rules";
import internalRouter from "./interfaces/http/routes/internal";
import notificationsRouter from "./interfaces/http/routes/notifications";
import { initSocketServer } from "./infrastructure/realtime/socketServer";
import analyticsRouter from "./interfaces/http/routes/analytics";
import filesRouter from "./interfaces/http/routes/files";

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173", credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));

app.use("/api/v1", healthRouter);

app.use(errorHandler);
app.use(passport.initialize());
app.use("/api/v1/auth", authRouter);
app.use("/api/v1", organizationsRouter);
app.use("/api/v1", workflowsRouter);
app.use("/api/v1", auditRouter);
app.use("/api/v1", formsRouter);
app.use("/api/v1", rulesRouter);
app.use("/api/v1", internalRouter);
app.use("/api/v1", notificationsRouter);
app.use("/api/v1", analyticsRouter);
app.use("/api/v1", filesRouter);

const PORT = process.env.PORT || 4000;

const server = app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});

initSocketServer(server);