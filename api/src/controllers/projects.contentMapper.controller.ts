import { Request, Response } from "express";
import { contentMapperService } from "../services/contentMapper.service.js";

/**
 * Puts test data.
 * @param req - The request object.
 * @param res - The response object.
 * @returns Promise<void>
 */
const putTestData = async (req: Request, res: Response): Promise<void> => {
  const resp = await contentMapperService.putTestData(req);
  res.status(200).json(resp);
};

/**
 * Gets content types.
 * @param req - The request object.
 * @param res - The response object.
 * @returns Promise<void>
 */
const getContentTypes = async (req: Request, res: Response): Promise<void> => {
  const resp = await contentMapperService.getContentTypes(req);
  res.status(200).json(resp);
};

/**
 * Gets field mapping.
 * @param req - The request object.
 * @param res - The response object.
 * @returns Promise<void>
 */
const getFieldMapping = async (req: Request, res: Response): Promise<void> => {
  const resp = await contentMapperService.getFieldMapping(req);
  res.status(200).json(resp);
};

/**
 * Gets existing content types.
 * @param req - The request object.
 * @param res - The response object.
 * @returns Promise<void>
 */
const getExistingContentTypes = async (
  req: Request,
  res: Response
): Promise<void> => {
  const resp = await contentMapperService.getExistingContentTypes(req);
  res.status(201).json(resp);
};

/**
 * Puts content type fields.
 * @param req - The request object.
 * @param res - The response object.
 * @returns Promise<void>
 */
const putContentTypeFields = async (
  req: Request,
  res: Response
): Promise<void> => {
  const resp = await contentMapperService.updateContentType(req);
  res.status(200).json(resp);
};

/**
 * Resets content type.
 * @param req - The request object.
 * @param res - The response object.
 * @returns Promise<void>
 */
const resetContentType = async (req: Request, res: Response): Promise<void> => {
  const resp = await contentMapperService.resetToInitialMapping(req);
  res.status(200).json(resp);
};

/**
 * Removes content mapper.
 * @param req - The request object.
 * @param res - The response object.
 * @returns Promise<void>
 */
const removeContentMapper = async (
  req: Request,
  res: Response
): Promise<void> => {
  const resp = await contentMapperService.removeContentMapper(req);
  res.status(200).json(resp);
};

/**
 * Gets single content types.
 * @param req - The request object.
 * @param res - The response object.
 * @returns Promise<void>
 */
const getSingleContentTypes = async (
  req: Request,
  res: Response
): Promise<void> => {
  const resp = await contentMapperService.getSingleContentTypes(req);
  res.status(201).json(resp);
};

/**
 * Removes mapping.
 * @param req - The request object.
 * @param res - The response object.
 * @returns Promise<void>
 */ 
// const removeMapping = async (req: Request, res: Response): Promise<void> => {    
//   const resp = await contentMapperService.removeMapping(req);  
//   res.status(200).json(resp);  
// };

export const contentMapperController = {
  getContentTypes,
  getFieldMapping,
  getExistingContentTypes,
  putTestData,
  putContentTypeFields,
  resetContentType,
  // removeMapping,
  getSingleContentTypes,
  removeContentMapper,
};
