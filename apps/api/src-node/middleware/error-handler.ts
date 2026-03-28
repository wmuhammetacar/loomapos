import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { ApiError } from "../utils/http";

export function notFound(_req: Request, res: Response) {
  return res.status(404).json({
    error: "NOT_FOUND",
    message: "Resource not found"
  });
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (error instanceof ZodError) {
    return res.status(422).json({
      error: "VALIDATION_ERROR",
      message: "Invalid request payload",
      details: error.flatten()
    });
  }

  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({
      error: "API_ERROR",
      message: error.message,
      details: error.details
    });
  }

  // eslint-disable-next-line no-console
  console.error(error);

  return res.status(500).json({
    error: "INTERNAL_SERVER_ERROR",
    message: "Unexpected server error"
  });
}
