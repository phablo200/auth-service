import { Request, Response, NextFunction } from "express";
import { RequestWithMe } from "../models/request_me.model";
import applicationService from "../services/application.service";
import { validate as uuidValidate } from 'uuid';
import { DEFAULT_APPLICATION_ID } from "../constants/application.constants";

async function requireApplicationId(req: Request, res: Response, next: NextFunction) {
  const applicationId = req.header("x-application-id");
  if (!applicationId) {
    return res.status(400).json({
      error: req.t("application.missingApplicationId"),
    });
  }
  
  if (applicationId !== DEFAULT_APPLICATION_ID && !uuidValidate(applicationId)) {
    return res.status(400).json({
      error: req.t("application.invalidApplicationId"),
    });
  }
  
  const application = await applicationService.findById(applicationId);
  if (!application) {
    return res.status(404).json({
      error: req.t("application.notFound"),
    });
  }
  (req as unknown as RequestWithMe).applicationId = applicationId;
  next();
}

export function getApplicationId(req: Request): string | null {
  return (req as unknown as RequestWithMe).applicationId || null;
}

export default requireApplicationId;
