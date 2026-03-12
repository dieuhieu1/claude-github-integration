// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from "vitest";
import { SignJWT, jwtVerify } from "jose";

vi.mock("server-only", () => ({}));

const mockSet = vi.fn();
const mockGet = vi.fn();
const mockCookieStore = { set: mockSet, get: mockGet };
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

const JWT_SECRET = new TextEncoder().encode("development-secret-key");

describe("createSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("sets the auth-token cookie", async () => {
    const { createSession } = await import("@/lib/auth");
    await createSession("user-123", "test@example.com");

    expect(mockSet).toHaveBeenCalledOnce();
    const [cookieName] = mockSet.mock.calls[0];
    expect(cookieName).toBe("auth-token");
  });

  test("cookie has correct options", async () => {
    const { createSession } = await import("@/lib/auth");
    await createSession("user-123", "test@example.com");

    const [, , options] = mockSet.mock.calls[0];
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
  });

  test("cookie is not secure in non-production environment", async () => {
    const { createSession } = await import("@/lib/auth");
    await createSession("user-123", "test@example.com");

    const [, , options] = mockSet.mock.calls[0];
    expect(options.secure).toBe(false);
  });

  test("cookie is secure in production environment", async () => {
    const originalEnv = process.env.NODE_ENV;
    vi.stubEnv("NODE_ENV", "production");

    const { createSession } = await import("@/lib/auth");
    await createSession("user-123", "test@example.com");

    const [, , options] = mockSet.mock.calls[0];
    expect(options.secure).toBe(true);

    vi.unstubAllEnvs();
  });

  test("cookie expires in approximately 7 days", async () => {
    const before = Date.now();
    const { createSession } = await import("@/lib/auth");
    await createSession("user-123", "test@example.com");
    const after = Date.now();

    const [, , options] = mockSet.mock.calls[0];
    const expiresAt: Date = options.expires;
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
  });

  test("token is a valid JWT containing userId and email", async () => {
    const { createSession } = await import("@/lib/auth");
    await createSession("user-123", "test@example.com");

    const [, token] = mockSet.mock.calls[0];
    const { payload } = await jwtVerify(token, JWT_SECRET);

    expect(payload.userId).toBe("user-123");
    expect(payload.email).toBe("test@example.com");
  });

  test("token uses HS256 algorithm", async () => {
    const { createSession } = await import("@/lib/auth");
    await createSession("user-123", "test@example.com");

    const [, token] = mockSet.mock.calls[0];
    const header = JSON.parse(atob(token.split(".")[0]));
    expect(header.alg).toBe("HS256");
  });

  test("token expires in 7 days", async () => {
    const before = Math.floor(Date.now() / 1000);
    const { createSession } = await import("@/lib/auth");
    await createSession("user-123", "test@example.com");
    const after = Math.floor(Date.now() / 1000);

    const [, token] = mockSet.mock.calls[0];
    const { payload } = await jwtVerify(token, JWT_SECRET);

    const sevenDaysSec = 7 * 24 * 60 * 60;
    expect(payload.exp).toBeGreaterThanOrEqual(before + sevenDaysSec);
    expect(payload.exp).toBeLessThanOrEqual(after + sevenDaysSec + 5);
  });
});

async function makeToken(
  payload: Record<string, unknown>,
  expirationTime = "7d"
) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expirationTime)
    .setIssuedAt()
    .sign(JWT_SECRET);
}

describe("getSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns null when no cookie is present", async () => {
    mockGet.mockReturnValue(undefined);

    const { getSession } = await import("@/lib/auth");
    const result = await getSession();

    expect(result).toBeNull();
  });

  test("returns session payload for a valid token", async () => {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const token = await makeToken({
      userId: "user-123",
      email: "test@example.com",
      expiresAt,
    });
    mockGet.mockReturnValue({ value: token });

    const { getSession } = await import("@/lib/auth");
    const result = await getSession();

    expect(result).not.toBeNull();
    expect(result?.userId).toBe("user-123");
    expect(result?.email).toBe("test@example.com");
  });

  test("returns null for a token signed with the wrong secret", async () => {
    const wrongSecret = new TextEncoder().encode("wrong-secret");
    const token = await new SignJWT({ userId: "user-123", email: "test@example.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .setIssuedAt()
      .sign(wrongSecret);
    mockGet.mockReturnValue({ value: token });

    const { getSession } = await import("@/lib/auth");
    const result = await getSession();

    expect(result).toBeNull();
  });

  test("returns null for an expired token", async () => {
    // Set exp to 1 second in the past
    const pastExp = Math.floor(Date.now() / 1000) - 1;
    const token = await new SignJWT({ userId: "user-123", email: "test@example.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime(pastExp)
      .setIssuedAt()
      .sign(JWT_SECRET);
    mockGet.mockReturnValue({ value: token });

    const { getSession } = await import("@/lib/auth");
    const result = await getSession();

    expect(result).toBeNull();
  });

  test("returns null for a malformed token string", async () => {
    mockGet.mockReturnValue({ value: "not.a.jwt" });

    const { getSession } = await import("@/lib/auth");
    const result = await getSession();

    expect(result).toBeNull();
  });

  test("reads the auth-token cookie by name", async () => {
    mockGet.mockReturnValue(undefined);

    const { getSession } = await import("@/lib/auth");
    await getSession();

    expect(mockGet).toHaveBeenCalledWith("auth-token");
  });
});
