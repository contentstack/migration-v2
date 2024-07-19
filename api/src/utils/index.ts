/**
 * Throws an error with a custom message and status code.
 * @param message - The error message.
 * @param statusCode - The HTTP status code associated with the error.
 * @throws {Error} - The error object with the specified message and status code.
 */
export const throwError = (message: string, statusCode: number) => {
  throw Object.assign(new Error(message), { statusCode });
};

/**
 * Checks if a value is empty.
 * @param val - The value to check.
 * @returns `true` if the value is empty, `false` otherwise.
 */
export const isEmpty = (val: unknown) =>
  val === undefined ||
  val === null ||
  (typeof val === "object" && !Object.keys(val).length) ||
  (typeof val === "string" && !val.trim().length);

/**
 * Wraps a promise with error handling to ensure it always resolves with an array containing either an error or the result.
 * @param promise - The promise to be wrapped.
 * @returns A new promise that resolves with an array containing either an error or the result.
 */
export const safePromise = (promise: Promise<any>): Promise<any> =>
  promise.then((res) => [null, res]).catch((err) => [err]);

//Generic method to get log message object
/**
 * Returns a log message object.
 *
 * @param methodName - The name of the method.
 * @param message - The log message.
 * @param user - The user object. Defaults to an empty object.
 * @param error - The error object. Optional.
 * @returns The log message object.
 */
export const getLogMessage = (
  methodName: string,
  message: string,
  user = {},
  error?: any
) => {
  return {
    methodName,
    message,
    ...(user && { user }),
    ...(error && { error }),
  };
};
