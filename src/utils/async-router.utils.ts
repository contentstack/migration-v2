import { Request, Response } from "express";

export const asyncRouter = (fn: any) => (req: Request, res: Response) => {
  Promise.resolve(fn(req, res)).catch((err) => {
    console.error("AsyncRouter Error: ", err);
    res.status(500).json({ message: "Internal Server Error" });
  });
};
