export interface UserModel {
    id: string;           // UUID
    profile_id: string;
    application_id: string;
    name: string;
    email: string;
    password: string;
    deleted: boolean;
    created_at: Date;
    created_by: string | null;
    updated_at: Date;
    updated_by: string | null;
  }
  