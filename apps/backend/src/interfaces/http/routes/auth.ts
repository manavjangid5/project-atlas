import { Router } from "express";
import rateLimit from "express-rate-limit";
import passport from "../../../infrastructure/auth/passport";
import * as authService from "../../../application/authService";

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
};

function setAuthCookies(res: any, accessToken: string, refreshToken: string) {
  res.cookie("accessToken", accessToken, { ...COOKIE_OPTS, maxAge: 15 * 60 * 1000 });
  res.cookie("refreshToken", refreshToken, { ...COOKIE_OPTS, maxAge: 30 * 24 * 60 * 60 * 1000 });
}

router.post("/register", authLimiter, async (req, res) => {
  const { email, password, name } = req.body;
  const { accessToken, refreshToken } = await authService.register(email, password, name);
  setAuthCookies(res, accessToken, refreshToken);
  res.status(201).json({ status: "ok" });
});

router.post("/login", authLimiter, async (req, res) => {
  const { email, password } = req.body;
  const { accessToken, refreshToken } = await authService.login(email, password);
  setAuthCookies(res, accessToken, refreshToken);
  res.json({ status: "ok" });
});

router.post("/refresh", async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) return res.status(401).json({ error: "No refresh token" });
  const { accessToken, refreshToken } = await authService.refresh(token);
  setAuthCookies(res, accessToken, refreshToken);
  res.json({ status: "ok" });
});

router.post("/logout", async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (token) await authService.logout(token);
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
  res.json({ status: "ok" });
});

// OAuth: Google
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"], session: false }));

router.get(
  "/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: "/login" }),
  async (req: any, res) => {
    const { accessToken, refreshToken } = await authService.findOrCreateOAuthUser(req.user);
    setAuthCookies(res, accessToken, refreshToken);
    res.redirect(process.env.FRONTEND_URL || "http://localhost:5173");
  }
);

// OAuth: GitHub
router.get("/github", passport.authenticate("github", { scope: ["user:email"], session: false }));

router.get(
  "/github/callback",
  passport.authenticate("github", { session: false, failureRedirect: "/login" }),
  async (req: any, res) => {
    const { accessToken, refreshToken } = await authService.findOrCreateOAuthUser(req.user);
    setAuthCookies(res, accessToken, refreshToken);
    res.redirect(process.env.FRONTEND_URL || "http://localhost:5173");
  }
);

export default router;