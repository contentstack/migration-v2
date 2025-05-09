import express from "express";
import { contentMapperController } from "../controllers/projects.contentMapper.controller.js";
import { asyncRouter } from "../utils/async-router.utils.js";

const router = express.Router({ mergeParams: true });

/**
 * Developer End Point to create dummy data
 * @route POST /createDummyData/:projectId
 */
router.post(
  "/createDummyData/:projectId",
  asyncRouter(contentMapperController.putTestData)
);

/**
 * Get ContentTypes List
 * @route GET /contentTypes/:projectId/:skip/:limit/:searchText?
 */
router.get(
  "/contentTypes/:projectId/:skip/:limit/:searchText?",
  asyncRouter(contentMapperController.getContentTypes)
);

/**
 * Get FieldMapping List
 * @route GET /fieldMapping/:contentTypeId/:skip/:limit/:searchText?
 */
router.get(
  "/fieldMapping/:projectId/:contentTypeId/:skip/:limit/:searchText?",
  asyncRouter(contentMapperController.getFieldMapping)
);

/**
 * Get Existing ContentTypes List
 * @route GET /:projectId
 */
router.get(
  "/:projectId/contentTypes/:contentTypeUid?",
  asyncRouter(contentMapperController.getExistingContentTypes)
);

/**
 * Get Existing GlobalFields List
 * @route GET /:projectId
 */
router.get(
  "/:projectId/globalFields/:globalFieldUid?",
  asyncRouter(contentMapperController.getExistingGlobalFields)
);

/**
 * Update FieldMapping or contentType
 * @route PUT /contentTypes/:orgId/:projectId/:contentTypeId
 */
router.put(
  "/contentTypes/:orgId/:projectId/:contentTypeId",
  asyncRouter(contentMapperController.putContentTypeFields)
);

/**
 * Reset FieldMapping or contentType
 * @route PUT /resetFields/:orgId/:projectId/:contentTypeId
 */
router.put(
  "/resetFields/:orgId/:projectId/:contentTypeId",
  asyncRouter(contentMapperController.resetContentType)
);

/**
 * Get Single contenttype data
 * @route GET /:projectId/:contentTypeUid
 */
// router.get(
//   "/:projectId/:contentTypeUid",
//   asyncRouter(contentMapperController.getSingleContentTypes)
// );

/**
 * Remove content mapper
 * @route GET /:orgId/:projectId/content-mapper
 */
router.get(
  "/:orgId/:projectId/content-mapper",
  asyncRouter(contentMapperController.removeContentMapper)
);

/**
 * Update content mapper
 * @route GET /:orgId/:projectId
 */
router.patch("/:orgId/:projectId/mapper_keys", asyncRouter(contentMapperController.updateContentMapper));

/**
 * Get Single Global Field data
 * @route GET /:projectId/:globalFieldUid
 */
// router.get("/:projectId/globalFields/:globalFieldUid",
//   asyncRouter(contentMapperController.getSingleGlobalField)
// );

export default router;
