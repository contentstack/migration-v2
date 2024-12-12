import { Request, Response } from "express";
import { contentMapperService } from "../services/contentMapper.service.js";
/**
 * Handles the PUT request to update test data.
 *
 * @param req - The request object.
 * @param res - The response object.
 * @returns A Promise that resolves to void.
 */
const putTestData = async (req: Request, res: Response): Promise<void> => {
  const resp = await contentMapperService.putTestData(req);
  res.status(200).json(resp);
};

/**
 * Retrieves the content types from the content mapper service and sends the response as JSON.
 *
 * @param req - The Express request object.
 * @param res - The Express response object.
 * @returns A Promise that resolves to void.
 */
const getContentTypes = async (req: Request, res: Response): Promise<void> => {
  const resp = await contentMapperService.getContentTypes(req);
  res.status(200).json(resp);
};
/**
 * Retrieves the field mapping for a given request and sends the response as JSON.
 *
 * @param req - The request object.
 * @param res - The response object.
 * @returns A Promise that resolves to void.
 */
const getFieldMapping = async (req: Request, res: Response): Promise<void> => {
  const resp = await contentMapperService.getFieldMapping(req);
  res.status(200).json(resp);
};
/**
 * Retrieves the existing content types.
 *
 * @param {Request} req - The request object.
 * @param {Response} res - The response object.
 * @returns {Promise<void>} - A promise that resolves when the operation is complete.
 */
const getExistingContentTypes = async (
  req: Request,
  res: Response
): Promise<void> => {
  const resp = await contentMapperService.getExistingContentTypes(req);
  res.status(201).json(resp);
};

/**
 * Retrieves the existing global fields.
 *
 * @param {Request} req - The request object.
 * @param {Response} res - The response object.
 * @returns {Promise<void>} - A promise that resolves when the operation is complete.
 */
const getExistingGlobalFields = async (
  req: Request,
  res: Response
): Promise<void> => {
  const resp = await contentMapperService.getExistingGlobalFields(req);
  res.status(201).json(resp);
};

/**
 * Updates the content type fields.
 *
 * @param {Request} req - The request object.
 * @param {Response} res - The response object.
 * @returns {Promise<void>} A promise that resolves when the content type fields are updated.
 */
const putContentTypeFields = async (
  req: Request,
  res: Response
): Promise<void> => {
  const resp = await contentMapperService.updateContentType(req);
  res.status(200).json(resp);
};
/**
 * Resets the content type to its initial mapping.
 *
 * @param req - The request object.
 * @param res - The response object.
 * @returns A Promise that resolves to void.
 */
const resetContentType = async (req: Request, res: Response): Promise<void> => {
  const resp = await contentMapperService.resetToInitialMapping(req);
  res.status(200).json(resp);
};
// TODO Will remove if not required
// const removeMapping = async (req: Request, res: Response): Promise<void> => {
//   const resp = await contentMapperService.removeMapping(req);
//   res.status(200).json(resp);
// };

/**
 * Removes a content mapper.
 *
 * @param {Request} req - The request object.
 * @param {Response} res - The response object.
 * @returns {Promise<void>} - A promise that resolves when the content mapper is removed.
 */
const removeContentMapper = async (
  req: Request,
  res: Response
): Promise<void> => {
  const resp = await contentMapperService.removeContentMapper(req);
  res.status(200).json(resp);
};

/**
 * Retrieves single content types.
 *
 * @param req - The request object.
 * @param res - The response object.
 * @returns A Promise that resolves to void.
 */
const getSingleContentTypes = async (
  req: Request,
  res: Response
): Promise<void> => {
  const resp = await contentMapperService.getSingleContentTypes(req);
  res.status(201).json(resp);
};

/**
 * Retrieves single global field.
 *
 * @param req - The request object.
 * @param res - The response object.
 * @returns A Promise that resolves to void.
 */
const getSingleGlobalField = async(req: Request, res: Response): Promise<void> => {
  const resp = await contentMapperService.getSingleGlobalField(req);
  res.status(201).json(resp);
}

/** 
* update content mapping details a project.
*
* @param req - The request object.
* @param res - The response object.
* @returns A Promise that resolves to void.
*/
const updateContentMapper = async (req: Request, res: Response): Promise<void> => {
  const project = await contentMapperService.updateContentMapper(req);
  res.status(project.status).json(project);
 }

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
  updateContentMapper,
  getExistingGlobalFields,
  getSingleGlobalField
};
