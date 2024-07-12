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
 * @returns True if the value is empty, false otherwise.
 */
export const isEmpty = (val: unknown) =>
  val === undefined ||
  val === null ||
  (typeof val === "object" && !Object.keys(val).length) ||
  (typeof val === "string" && !val.trim().length);

/**
 * Wraps a promise with error handling.
 * @param promise - The promise to wrap.
 * @returns A new promise that resolves with an array containing the error (if any) and the result of the original promise.
 */
export const safePromise = (promise: Promise<any>): Promise<any> =>
  promise.then((res) => [null, res]).catch((err) => [err]);

/**
 * Creates a log message object.
 * @param methodName - The name of the method.
 * @param message - The log message.
 * @param user - The user object (optional).
 * @param error - The error object (optional).
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
