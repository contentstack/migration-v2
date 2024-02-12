import { Request, Response } from "express";
import { uploadsService } from "../services/projects.uploads.service";

const initializeUpload = async (req: Request, res: Response) => {
  const resp = await uploadsService.initializeUpload(req);
  res.status(resp.status).json(resp.data);
};

const getPreSignedUrls = async (req: Request, res: Response) => {
  const resp = await uploadsService.getPreSignedUrls(req);
  res.status(resp.status).json(resp.data);
};
const finalizeUpload = async (req: Request, res: Response) => {
  const resp = await uploadsService.finalizeUpload(req);
  res.status(resp.status).json(resp.data);
};

export const uploadController = {
  initializeUpload,
  getPreSignedUrls,
  finalizeUpload,
};
