import profileRepository from "../repositories/profile.repository";
import { ProfileModel } from "../models/profile.model";

class ProfileService {
  async createProfile(
    name: string,
    created_by?: string
  ): Promise<ProfileModel> {
    const existing = await profileRepository.findByName(name);

    if (existing) {
      const err: any = new Error("Profile already exists");
      err.status = 400;
      throw err;
    }

    const newProfile: Omit<ProfileModel, "id" | "deleted"> = {
        name,
        created_by: created_by ?? null,
        created_at: new Date(),
        updated_by: created_by ?? null,
        updated_at: new Date(),
    }
    return profileRepository.create(newProfile);
  }

  async getAllProfiles(): Promise<ProfileModel[]> {
    return profileRepository.findAll();
  }

  async getProfileById(id: string): Promise<ProfileModel | null> {
    return profileRepository.findById(id);
  }

  async updateProfile(
    id: string,
    data: Partial<Pick<ProfileModel, "name" | "updated_by">>
  ): Promise<ProfileModel | null> {
    return profileRepository.update(id, data);
  }

  async deleteProfile(id: string, deletedBy?: string): Promise<boolean> {
    return profileRepository.delete(id, deletedBy);
  }

  async undeleteProfileById(id: string): Promise<ProfileModel | null> {
    return profileRepository.undeleteById(id);
  }
}

export default new ProfileService();
