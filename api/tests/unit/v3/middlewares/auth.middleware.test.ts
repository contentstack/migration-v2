import { describe, it, expect, vi } from "vitest";
import jwt from "jsonwebtoken";

/**
 * TDD — v3 auth.middleware (authenticateV3User).
 * Backs TC_SRC_048 (every /v3 endpoint requires a valid app_token → 401 without).
 * feature.md NFR-3 / EC-5.
 *
 * NOTE: this middleware predates this group (T-1 scaffold), so there is no red
 * phase — the tests confirm the existing behavior. Dynamic import runs after the
 * env is stubbed so v3Config captures the test secret.
 */
const importMw = async () => {
  vi.resetModules();
  return (await import("../../../../v3/middlewares/auth.middleware.js"))
    .authenticateV3User;
};

const mkRes = () => {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
};

describe("v3 auth.middleware — authenticateV3User", () => {
  it("TC_SRC_048 (positive): a valid app_token calls next and attaches token_payload", async () => {
    const authenticateV3User = await importMw();
    const secret = process.env.APP_TOKEN_KEY as string;
    const token = jwt.sign({ region: "NA", user_id: "u1", is_sso: false }, secret);

    const req: any = {
      get: (h: string) => (h === "app_token" ? token : undefined),
      body: {},
    };
    const res = mkRes();
    const next = vi.fn();

    authenticateV3User(req, res, next);
    await new Promise((r) => setImmediate(r)); // jwt.verify callback is async

    expect(next).toHaveBeenCalledOnce();
    expect(req.body.token_payload).toMatchObject({ region: "NA", user_id: "u1" });
  });

  // Negative — taxonomy #5 (permission/auth denial): no token → 401, next not called.
  it("TC_SRC_048 (negative): a missing app_token is rejected 401 and next is not called", async () => {
    const authenticateV3User = await importMw();
    const req: any = { get: () => undefined, body: {} };
    const res = mkRes();
    const next = vi.fn();

    authenticateV3User(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Unauthorized - Token missing" })
    );
    expect(next).not.toHaveBeenCalled();
  });
});
