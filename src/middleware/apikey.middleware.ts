import { Request, Response, NextFunction } from "express";
import { RequestWithMe } from "../models/request_me.model";
import dotenv from "dotenv";
dotenv.config();

function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.header("x-api-key");
  const expectedApiKey = process.env.API_KEY;

  if (!apiKey) {
    return res.status(400).json({
      error: req.t("auth.missingApiKey"),
    });
  }

  if (!expectedApiKey) {
    // Misconfiguration safeguard
    return res.status(500).json({
      error: req.t("auth.apiKeyNotConfigured"),
    });
  }

  if (apiKey !== expectedApiKey) {
    return res.status(401).json({
      error: req.t("auth.invalidApiKey"),
    });
  }

  // Attach api key to request (optional but consistent with your pattern)
  (req as unknown as RequestWithMe).apiKey = apiKey;
  next();
}

export function getApiKey(req: Request): string | null {
  return (req as unknown as RequestWithMe).apiKey || null;
}

export default requireApiKey;
