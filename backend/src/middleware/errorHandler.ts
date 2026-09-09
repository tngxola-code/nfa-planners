import { NextFunction, Request, Response } from 'express';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error('[API ERROR]', err);

  const isProduction = process.env.NODE_ENV === 'production';

  return res.status(500).json({
    error: 'Internal server error',
    ...(!isProduction && { message: err.message })
  });
}
