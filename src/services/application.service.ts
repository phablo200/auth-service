import applicationRepository from "../repositories/application.repository";
import { ApplicationModel } from "../models/application.model";

class ApplicationService {
  async findById(id: string): Promise<ApplicationModel | null> {
    return await applicationRepository.findById(id);
  }
}

export default new ApplicationService();
