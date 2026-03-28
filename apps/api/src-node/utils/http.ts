import type { NextFunction, Request, Response } from "express";

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
  }
}

export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res, next).catch(next);
  };
}

export function readRouteParam(value: string | string[] | undefined, paramName: string): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  throw new ApiError(400, `Invalid route param: ${paramName}`);
}
