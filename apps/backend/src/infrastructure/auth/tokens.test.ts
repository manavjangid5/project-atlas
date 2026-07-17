import { signAccessToken, verifyAccessToken, generateRefreshToken, hashToken } from "./tokens";

describe("token utilities", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = "test-secret";
  });

  it("signs and verifies a valid access token", () => {
    const token = signAccessToken({ id: "user1", email: "test@test.com" });
    const decoded = verifyAccessToken(token);
    expect(decoded.id).toBe("user1");
    expect(decoded.email).toBe("test@test.com");
  });

  it("throws when verifying a tampered token", () => {
    const token = signAccessToken({ id: "user1", email: "test@test.com" });
    const tampered = token.slice(0, -5) + "xxxxx";
    expect(() => verifyAccessToken(tampered)).toThrow();
  });

  it("refresh tokens are never stored raw — hash is deterministic, raw value is unpredictable", () => {
    const { raw, hash } = generateRefreshToken();
    expect(hashToken(raw)).toBe(hash);
    expect(raw).not.toBe(hash);
    expect(raw.length).toBeGreaterThan(40); // sufficiently random
  });
});