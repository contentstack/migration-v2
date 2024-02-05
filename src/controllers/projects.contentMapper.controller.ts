import { Request, Response } from "express";
import { contentMapperService } from "../services/contentMapper.service";
const putTestData = async (req: Request, res: Response): Promise<void> => {
  const resp = await contentMapperService.putTestData(req);
  res.status(200).json(resp);
};

const getContentTypes = async (req: Request, res: Response): Promise<void> => {
  const resp = await contentMapperService.getContentTypes(req);
  res.status(200).json(resp);
};
const getFieldMapping = async (req: Request, res: Response): Promise<void> => {
  const resp = await contentMapperService.getFieldMapping(req);
  res.status(200).json(resp);
};
const getExistingContentTypes = async (
  req: Request,
  res: Response
): Promise<void> => {
  const resp = await contentMapperService.getExistingContentTypes(req);
  res.status(201).json(resp);
};
const putContentTypeFields = async (
  req: Request,
  res: Response
): Promise<void> => {
  const resp = await contentMapperService.updateContentType(req);
  res.status(200).json(resp);
};
const resetContentType = async (req: Request, res: Response): Promise<void> => {
  const resp = await contentMapperService.resetToInitialMapping(req);
  res.status(200).json(resp);
};

export const contentMapperController = {
  getContentTypes,
  getFieldMapping,
  getExistingContentTypes,
  putTestData,
  putContentTypeFields,
  resetContentType,
};
