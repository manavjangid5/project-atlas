import { doubleCsrf } from "csrf-csrf";
import type { Request } from "express";

const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || process.env.JWT_SECRET!,
  cookieName: "csrf-token",
  cookieOptions: {
    httpOnly: false,
    sameSite: (process.env.NODE_ENV === "production" ? "none" : "lax") as "none" | "lax",
    secure: process.env.NODE_ENV === "production",
  },
  getSessionIdentifier: () => "atlas-session",
  // Explicitly tell the library where to find the token on incoming
  // requests — without this, some versions of csrf-csrf don't
  // reliably read the x-csrf-token header, causing valid tokens to
  // still fail validation.
  getCsrfTokenFromRequest: (req: Request) => req.headers["x-csrf-token"] as string,
});

export { doubleCsrfProtection, generateCsrfToken };