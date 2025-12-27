import { Request, Response } from "express";
import profileService from "../services/profile.service";
import { HttpStatus } from "../constants/http.constants";

class ProfileController {
  async createProfile(req: Request, res: Response) {
    try {
      const { name } = req.body;

      const profile = await profileService.createProfile(name);

      res.status(HttpStatus.CREATED).json(profile);
    } catch (err: any) {
      console.error(err);
      res
        .status(err.status || HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ error: err.message });
    }
  }

  async getAllProfiles(_req: Request, res: Response) {
    try {
      const profiles = await profileService.getAllProfiles();
      res.status(HttpStatus.OK).json(profiles);
    } catch (err: any) {
      res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ error: err.message });
    }
  }

  async getProfileById(req: Request, res: Response) {
    try {
      const profile = await profileService.getProfileById(req.params.id);

      if (!profile) {
        return res
          .status(HttpStatus.NOT_FOUND)
          .json({ error: "Profile not found" });
      }

      res.status(HttpStatus.OK).json(profile);
    } catch (err: any) {
      res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ error: err.message });
    }
  }

  async updateProfile(req: Request, res: Response) {
    try {
      const updatedProfile = await profileService.updateProfile(
        req.params.id,
        req.body
      );

      if (!updatedProfile) {
        return res
          .status(HttpStatus.NOT_FOUND)
          .json({ error: "Profile not found" });
      }

      res.status(HttpStatus.OK).json(updatedProfile);
    } catch (err: any) {
      res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ error: err.message });
    }
  }

  async deleteProfile(req: Request, res: Response) {
    try {
      const deleted = await profileService.deleteProfile(req.params.id);

      if (!deleted) {
        return res
          .status(HttpStatus.NOT_FOUND)
          .json({ error: "Profile not found" });
      }

      res.status(HttpStatus.NO_CONTENT).send();
    } catch (err: any) {
      res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ error: err.message });
    }
  }
}

export default new ProfileController();
