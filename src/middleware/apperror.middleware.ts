import { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/app.error";
import { HttpStatus } from "../constants/http.constants";

export default function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: req.t(err.key),
    });
  }
  return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
    error: req.t("errors.internalServerError"),
  });
}
