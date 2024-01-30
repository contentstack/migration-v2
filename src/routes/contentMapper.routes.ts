import express from "express";
import { contentMapperController } from "../controllers/projects.contentMapper.controller";
import { asyncRouter } from "../utils/async-router.utils";

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
  "/fieldMappnig/:contentTypeId/:skip/:limit/:searchText?",
  asyncRouter(contentMapperController.getFieldMapping)
);
//Get Existing ContentTypes List
//To Do
router.get(
  "/:projectId/:stackUid",
  asyncRouter(contentMapperController.getExistingContentTypes)
);
//Update FieldMapping or contentType
router.put(
  "/contentTypes/:contentTypeId",
  asyncRouter(contentMapperController.putContentTypeFields)
);
//Reset FieldMapping or contentType
router.put(
  "/resetFields/:contentTypeId",
  asyncRouter(contentMapperController.resetContentType)
);

export default router;
