import { Request, Response } from "express";

import { HTTP_CODES } from "../constants/http.js";
import {
  getV3Project,
  setV3DestinationToken,
  upsertV3Destination,
} from "../models/project.store.js";
import { V3Destination, V3ImportAuthMethod } from "../models/types.js";
import { csManagement, TokenPayload } from "../services/csManagement.service.js";
import { v3Log } from "../utils/logger.util.js";
import { resolveRegionCredential } from "../utils/region-credential.util.js";
import {
  assertSecretEncryptionConfigured,
  encryptSecret,
} from "../utils/secret.util.js";

/**
 * v3 Destination controller (Content Map & Audit — Destination panel).
 * Thin handlers over the unit-tested v3 services. Errors thrown by services
 * carry a `.status` and are mapped by the v3 error middleware via asyncRouter.
 *
 * Region/organization/existing-stack LISTING is deliberately absent here: the
 * Destination panel reuses `cs-source-selection`'s `/v3/source/{regions,orgs,
 * stacks,branches}` endpoints (trd.md TC-1 / TR-2) rather than duplicating them.
 */
const VALID_METHODS: V3ImportAuthMethod[] = ["management", "authToken"];

const badRequest = (res: Response, message: string) =>
  res.status(HTTP_CODES.BAD_REQUEST).json({
    error: { code: HTTP_CODES.BAD_REQUEST, message },
  });

/**
 * Resolves the Contentstack credential for a destination call. A destination
 * region other than the session's home region requires a completed
 * region-login, whose resolved userId the client passes back as `regionUserId`.
 */
const credentialFor = (
  req: Request,
  region?: string,
  regionUserId?: string
): TokenPayload =>
  resolveRegionCredential(req.body?.token_payload, region, regionUserId);

// ---- API-4: create a new destination stack (FR-1.4, FR-1.5, TR-11) ----
const createStack = async (req: Request, res: Response) => {
  const { orgId, name, description, masterLocale, region, regionUserId } = (req.body ??
    {}) as Record<string, any>;
  if (!orgId) return badRequest(res, "'orgId' is required.");
  if (!name || !String(name).trim()) return badRequest(res, "'name' is required.");

  const stack = await csManagement.createStack(
    credentialFor(req, region, regionUserId),
    orgId,
    String(name).trim(),
    description ? String(description).trim() : undefined,
    masterLocale ? String(masterLocale).trim() : undefined
  );
  return res.status(HTTP_CODES.CREATED).json(stack);
};

/**
 * Every locale Contentstack supports — feeds the create-stack master-locale
 * picker. Not stack-scoped: the stack being named doesn't exist yet.
 */
const listContentstackLocales = async (req: Request, res: Response) => {
  const locales = await csManagement.listContentstackLocales(
    credentialFor(
      req,
      req.query.region as string | undefined,
      req.query.regionUserId as string | undefined
    )
  );
  return res.status(HTTP_CODES.OK).json({ locales });
};

/**
 * API-3: create a read/write management token on the destination stack
 * (FR-3.3, TR-13), and store its secret encrypted against the project.
 *
 * The secret is NOT returned. It is what the later Migrate step authenticates
 * with, so it has to be stored somewhere — and this handler is the only place it
 * ever exists. Handing it to the browser so the browser could send it back on the
 * persist call would put a permanent write credential into Redux, a network tab
 * and browser memory for no gain. So the server keeps it: encrypt, store, return
 * the public identity only.
 *
 * Order of operations, which is load-bearing:
 *   1. validate the request        — a mint with nowhere to store is worthless
 *   2. assert encryption is usable — a mint we cannot store is worse than worthless
 *   3. mint on Contentstack
 *   4. encrypt + store
 * Steps 1 and 2 come first because these tokens are created with
 * `is_never_expires: true`: an unstorable one is a permanent write credential left
 * on the customer's stack that this tool can neither use nor revoke.
 */
const createManagementToken = async (req: Request, res: Response) => {
  const { projectId, stackApiKey, name, description, branches, region, regionUserId } =
    (req.body ?? {}) as Record<string, any>;
  if (!projectId) return badRequest(res, "'projectId' is required.");
  if (!stackApiKey) return badRequest(res, "'stackApiKey' is required.");
  if (!name || !String(name).trim()) return badRequest(res, "'name' is required.");

  // Throws a 500 naming the missing variable. Deliberately before the mint.
  assertSecretEncryptionConfigured();

  const token = await csManagement.createManagementToken(
    credentialFor(req, region, regionUserId),
    stackApiKey,
    String(name).trim(),
    {
      description: typeof description === "string" ? description : undefined,
      branches: Array.isArray(branches) ? branches.map(String) : undefined,
    }
  );

  try {
    await setV3DestinationToken(
      String(projectId),
      {
        uid: token.uid,
        name: token.name,
        stackApiKey: String(stackApiKey),
        secretEncrypted: encryptSecret(token.secret),
        createdAt: new Date().toISOString(),
      },
      new Date().toISOString()
    );
  } catch (e: any) {
    /*
      The token now exists on the customer's stack but we could not record its
      secret — the one failure mode this ordering cannot design away, since the
      mint is remote and the store is local.

      The message names the token so the operator can go and delete it, rather
      than leaving an unexplained permanent credential behind. The token uid is an
      identifier, not customer content, so it is safe to log (NFR-9).
    */
    v3Log("destination.token.store_failed", { projectId: String(projectId), tokenUid: token.uid });
    const err = new Error(
      `Management token '${token.name}' was created on the stack but could not be saved (${e?.message ?? "unknown error"}). Delete it in Contentstack and try again.`
    ) as Error & { status?: number };
    err.status = e?.status === 404 ? HTTP_CODES.NOT_FOUND : HTTP_CODES.SERVER_ERROR;
    throw err;
  }

  // The public identity only — never `token.secret`.
  return res.status(HTTP_CODES.CREATED).json({ uid: token.uid, name: token.name });
};

// ---- API-5: destination stack content statistics (FR-10.2–10.4, TR-14) ----
const getStackStats = async (req: Request, res: Response) => {
  const { apiKey } = req.params as { apiKey: string };
  const stats = await csManagement.getStackStats(
    credentialFor(
      req,
      req.query.region as string | undefined,
      req.query.regionUserId as string | undefined
    ),
    apiKey
  );
  return res.status(HTTP_CODES.OK).json(stats);
};

// ---- Locales on the destination stack (feeds FR-4.1/FR-4.2 dropdowns) ----
const listLocales = async (req: Request, res: Response) => {
  const stackApiKey = req.query.stackApiKey as string | undefined;
  if (!stackApiKey) return badRequest(res, "Query param 'stackApiKey' is required.");

  const locales = await csManagement.listLocales(
    credentialFor(
      req,
      req.query.region as string | undefined,
      req.query.regionUserId as string | undefined
    ),
    stackApiKey
  );
  return res.status(HTTP_CODES.OK).json({ locales });
};

// ---- API-1: persist the destination selection (FR-8.2, TR-9) ----
const persistDestination = async (req: Request, res: Response) => {
  const { projectId } = req.params as { projectId: string };
  const { token_payload, ...rest } = (req.body ?? {}) as Record<string, any>;
  const destination = rest as V3Destination;

  if (!destination.stack?.apiKey) {
    return badRequest(res, "Invalid destination: 'stack.apiKey' is required.");
  }
  if (!VALID_METHODS.includes(destination.importAuth?.method)) {
    return badRequest(
      res,
      "Invalid destination: 'importAuth.method' must be 'management' or 'authToken'."
    );
  }

  const saved = await upsertV3Destination(projectId, destination, new Date().toISOString());
  return res.status(HTTP_CODES.OK).json({ destination: saved });
};

// ---- API-2: read the persisted destination selection (UC-5 resume) ----
const getDestination = async (req: Request, res: Response) => {
  const { projectId } = req.params as { projectId: string };
  const tp = (req.body?.token_payload ?? {}) as { region?: string; user_id?: string };
  const project = await getV3Project(projectId, {
    region: tp.region ?? "",
    owner: tp.user_id ?? "",
  });
  if (!project || !project.destination) {
    return res.status(HTTP_CODES.NOT_FOUND).json({
      error: {
        code: HTTP_CODES.NOT_FOUND,
        message: "No destination selection found for this project.",
      },
    });
  }
  return res.status(HTTP_CODES.OK).json({ destination: project.destination });
};

export const destinationController = {
  createStack,
  listContentstackLocales,
  createManagementToken,
  getStackStats,
  listLocales,
  persistDestination,
  getDestination,
};
