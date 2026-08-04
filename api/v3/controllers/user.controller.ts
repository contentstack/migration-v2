import { Request, Response } from "express";

import { HTTP_CODES } from "../constants/http.js";
import { csManagement, TokenPayload } from "../services/csManagement.service.js";

/**
 * v3 user controller (cs-project-dashboard API-3).
 *
 * One read: the authenticated user's display identity, for the projects page
 * avatar. Deliberately its own endpoint rather than a field bolted onto the
 * organizations listing — nothing on that page needs an organization list, and a
 * caller asking for a name should not be handed one (trd.md TC-8).
 */
const getUser = async (req: Request, res: Response) => {
  const tp = (req.body?.token_payload ?? {}) as TokenPayload;
  const user = await csManagement.getUser(tp);
  // Every field is optional: Contentstack does not guarantee a name, and
  // SSO-provisioned users frequently have neither (feature.md EC-16–EC-18).
  return res.status(HTTP_CODES.OK).json({ user });
};

export const userController = { getUser };
