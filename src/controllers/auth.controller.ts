import { Request, Response } from "express";
import { userService } from "../services/auth.service";
const login = async (req: Request, res: Response) => {
  try {
    const apiResp = await userService.login(req);
    res.status(200).json(apiResp);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const authController = {
  login,
};
