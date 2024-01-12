import { NextFunction, Request, Response } from "express";
import { userService } from "../services/auth.service";
import { constants } from "../constants";

const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const resp = await userService.login(req);
    res.status(resp?.status).json(resp?.data);
  } catch (error) {
    console.error(error);
    next(error);
  }
};

const RequestSms = async (req: Request, res: Response) => {
  try {
    const resp = await userService.requestSms(req);
    res.status(resp.status).json(resp.data);
  } catch (error) {
    console.error(error);
    res
      .status(constants.HTTP_CODES.SOMETHING_WRONG)
      .json({ message: constants.HTTP_TEXTS.INTERNAL_ERROR });
  }
};

const getUserProfile = async (req: Request, res: Response) => {
  try {
    const user = await userService.getUserProfile(req);
    res.status(200).json(user);
  } catch (error) {
    console.error(error);
  }
};

export const authController = {
  login,
  RequestSms,
  getUserProfile,
};
