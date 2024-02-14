import express from "express";
import { projectController } from "../controllers/projects.controller";
import { asyncRouter } from "../utils/async-router.utils";
import { contentMapperController } from "../controllers/projects.contentMapper.controller";

const router = express.Router({ mergeParams: true });

//TODO Will update
// Upload project's file
router.put(
  "/:projectId/file-path",
  asyncRouter(projectController.updateFileFormat)
);

//TODO Will update
//Add Initial ContentMapper
router.post(
  "/initialMapper/:projectId",
  asyncRouter(contentMapperController.putTestData)
);

export default router;
