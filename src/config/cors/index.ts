import { CorsOptions } from "cors";

export const allowedOrigins = ["http://localhost:5173"];

const corsOptions: CorsOptions = {
  origin: allowedOrigins,
};

export default corsOptions;
