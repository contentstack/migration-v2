import express from "express";
import { contentMapperController } from "../controllers/projects.contentMapper.controller.js";
import { asyncRouter } from "../utils/async-router.utils.js";

const router = express.Router({ mergeParams: true });

//Developer End Point to create dummy data
router.post(
  "/createDummyData/:projectId",
  asyncRouter(contentMapperController.putTestData)
);

//Get ContentTypes List
router.get(
  "/contentTypes/:projectId/:skip/:limit/:searchText?",
  asyncRouter(contentMapperController.getContentTypes)
);
//Get FieldMapping List
router.get(
  "/fieldMapping/:contentTypeId/:skip/:limit/:searchText?",
  asyncRouter(contentMapperController.getFieldMapping)
);
//Get Existing ContentTypes List

router.get(
  "/:projectId",
  asyncRouter(contentMapperController.getExistingContentTypes)
);
//Update FieldMapping or contentType
router.put(
  "/contentTypes/:orgId/:projectId/:contentTypeId",
  asyncRouter(contentMapperController.putContentTypeFields)
);
//Reset FieldMapping or contentType
router.put(
  "/resetFields/:orgId/:projectId/:contentTypeId",
  asyncRouter(contentMapperController.resetContentType)
);
//get Single contenttype data
router.get(
  "/:projectId/:contentTypeUid",
  asyncRouter(contentMapperController.getSingleContentTypes)
);

export default router;
