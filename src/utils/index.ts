export const throwError = (message: string, statusCode: number) => {
  throw Object.assign(new Error(message), { statusCode });
};

export const isEmpty = (val: unknown) =>
  val === undefined ||
  val === null ||
  (typeof val === "object" && !Object.keys(val).length) ||
  (typeof val === "string" && !val.trim().length);
