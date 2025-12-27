export type RequestWithMe = Request & { me?: { token: string }, applicationId?: string };
