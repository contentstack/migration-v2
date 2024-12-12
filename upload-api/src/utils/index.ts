//Generic method to get log message object
export const getLogMessage = (methodName: string, message: string, user = {}, error?: any) => {
  return {
    methodName,
    message,
    ...(user && { user }),
    ...(error && { error })
  };
};

export const safePromise = (promise: Promise<any>): Promise<any> =>
  promise.then((res) => [null, res]).catch((err) => [err]);
