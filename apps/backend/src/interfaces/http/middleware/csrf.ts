import { doubleCsrf } from "csrf-csrf";

const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || process.env.JWT_SECRET!,
  cookieName: "csrf-token",
  cookieOptions: {
  httpOnly: false,
  sameSite: (process.env.NODE_ENV === "production" ? "none" : "lax") as "none" | "lax",
  secure: process.env.NODE_ENV === "production",
},
  getSessionIdentifier: (req) => req.cookies?.accessToken || "anonymous",
});

export { doubleCsrfProtection, generateCsrfToken };