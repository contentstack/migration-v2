import { Request, Response } from "express";
import axios from "axios";
import { API_MGMT_URL } from "../config";

const createUserService = () => {
  const loginUser = async (req: Request, res: Response): Promise<any> => {
    const userData = req.body;
    const apiResponse = await axios({
      method: "POST",
      url: API_MGMT_URL,
      headers: {
        "Content-Type": "application/json",
      },
      data: userData,
    });

    return apiResponse.data;
  };

  return {
    loginUser,
  };
};

export const userService = createUserService();
