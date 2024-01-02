import { Request } from "express";
import { config } from "../config";
import { generateToken } from "../utils/jwt.utils";
import https from "../utils/https.utils";
import * as fs from "fs/promises";
import { MigrationPayload, ResponseType } from "../models/types";

const login = async (req: Request): Promise<ResponseType | null> => {
  const userData = req.body;

  try {
    const apiResponse = await https({
      method: "POST",
      url: config.CS_API.US,
      headers: {
        "Content-Type": "application/json",
      },
      data: userData,
    });

    if (apiResponse) {
      const migration_payload: MigrationPayload = {
        region: userData.region,
        user_id: apiResponse.data.user.uid,
      };
      const migration_token = generateToken(migration_payload);
      const response = {
        message: apiResponse.data.notice,
        status: 200,
        migration_token,
      };

      // Create an object with migration_token as the key
      const dataToWrite = {
        [migration_token]: apiResponse.data.user.authtoken,
      };

      // Write the data to a JSON file (e.g., tokens.json)
      await fs.writeFile("tokens.json", JSON.stringify(dataToWrite, null, 2));

      return response;
    }

    // Explicit return statement in case apiResponse is falsy
    return null;
  } catch (error) {
    // Handle errors (e.g., log, return an error response)
    console.error(error);
    return {
      message: "Error during login",
      status: 500,
      migration_token: null,
    };
  }
};

export const userService = {
  login,
};
