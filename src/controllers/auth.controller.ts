import { Request, Response } from "express";
import { userService } from "../services/auth.service";

const authController = {
  async login(req: Request, res: Response): Promise<void> {
    try {
      const apiResp = await userService.loginUser(req);
      res.status(500).json(apiResp);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
};

export default authController;
