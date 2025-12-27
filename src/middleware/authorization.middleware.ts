import { Request, Response, NextFunction } from "express";
import { RequestWithMe } from "../models/request_me.model";

/**
 * Middleware to check for presence of Authorization header with Bearer token
 */
function requireAuthToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Invalid Authorization header format' });
  }

  (req as unknown as RequestWithMe).me = { token };  
  next();
}

export function getAuthToken(req: Request): string | null {
  const authHeader = req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.split(' ')[1];
}

export default requireAuthToken;
