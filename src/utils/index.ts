import mongoose from "mongoose";

export const throwError = (message: string, statusCode: number) => {
  throw Object.assign(new Error(message), { statusCode });
};

export const isEmpty = (val: unknown) =>
  val === undefined ||
  val === null ||
  (typeof val === "object" && !Object.keys(val).length) ||
  (typeof val === "string" && !val.trim().length);

export const safePromise = (promise: Promise<any>): Promise<any> =>
  promise.then((res) => [null, res]).catch((err) => [err]);

//Generic method to get log message object
export const getLogMessage = (
  message: string,
  methodName: string,
  user = {},
  error?: any
) => {
  return {
    message,
    methodName,
    ...(user && { user }),
    ...(error && { error }),
  };
};

export const isValidObjectId = (id: string | undefined) =>
  mongoose.isValidObjectId(id);

export const getMongooseID = () => new mongoose.Types.ObjectId();
