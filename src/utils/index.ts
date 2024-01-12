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
export const getLogMessage = (methodName: string, message = {}, user = {}) => {
  return {
    methodName: methodName,
    message: message,
    user: user,
  };
};
