export type ApplicationModel = {
    id: string;
    name: string;
    deleted: boolean;
    created_at: Date;
    created_by: string | null;
    updated_at: Date;
    updated_by: string | null;
};