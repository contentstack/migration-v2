import { Request, Response } from "express";
import { projectService } from "../services/projects.service";

const controller = () => {
  const getAllProjects = async (req: Request, res: Response): Promise<void> => {
    try {
      const allProjects = await projectService.getAllProjects(req);
      res.status(200).json(allProjects);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  };
  const getProject = async (req: Request, res: Response): Promise<void> => {
    try {
      const project = await projectService.getProject(req);
      res.status(200).json(project);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  };
  const createProject = async (req: Request, res: Response): Promise<void> => {
    try {
      const project = await projectService.createProject(req);
      res.status(201).json(project);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  };
  const deleteProject = async (req: Request, res: Response): Promise<void> => {
    try {
      const project = await projectService.deleteProject(req);
      res.status(200).json(project);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  };
  const updateProject = async (req: Request, res: Response): Promise<void> => {
    try {
      const project = await projectService.updateProject(req);
      res.status(200).json(project);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  };

  return {
    getAllProjects,
    getProject,
    createProject,
    updateProject,
    deleteProject,
  };
};

export const projectController = controller();
