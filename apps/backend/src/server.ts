import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

import healthRouter from "./interfaces/http/routes/health";
import { errorHandler } from "./interfaces/http/middleware/errorHandler";

import passport from "./infrastructure/auth/passport";
import authRouter from "./interfaces/http/routes/auth";
import organizationsRouter from "./interfaces/http/routes/organizations";
dotenv.config();

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

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});