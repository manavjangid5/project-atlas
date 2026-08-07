import { assertSafeUrl } from "./urlSafety";

describe("assertSafeUrl", () => {
  it("blocks localhost", async () => {
    await expect(assertSafeUrl("http://localhost:4000/")).rejects.toThrow();
  });

  it("blocks loopback IP", async () => {
    await expect(assertSafeUrl("http://127.0.0.1/")).rejects.toThrow();
  });

  it("blocks the cloud metadata IP specifically", async () => {
    await expect(assertSafeUrl("http://169.254.169.254/")).rejects.toThrow();
  });

  it("blocks non-http(s) protocols", async () => {
    await expect(assertSafeUrl("file:///etc/passwd")).rejects.toThrow();
  });

  it("allows a genuine public URL", async () => {
    await expect(assertSafeUrl("https://jsonplaceholder.typicode.com/todos/1")).resolves.not.toThrow();
  });
});