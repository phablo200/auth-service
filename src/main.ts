import express, { Request, Response } from "express";
import fs from "fs";
import path from "path";
import userRoutes from "./routes/user.route";
import authRoutes from "./routes/auth.routes";
import i18next from "./config/i18n";
import i18nextMiddleware from "i18next-http-middleware";
import errorHandler from "./middleware/apperror.middleware";

const pkgPath = path.resolve(__dirname, "../package.json");
const pkgRaw = fs.readFileSync(pkgPath, "utf-8");
const pkg = JSON.parse(pkgRaw);
const { version } = pkg;

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json())
app.use(i18nextMiddleware.handle(i18next));
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});
app.get("/", (_req: Request, res: Response) => {
  res.json({
    service: "auth210",
    version,
  });
});

app.use("/api", userRoutes);
app.use("/api", authRoutes);
app.use(errorHandler);

// Server
app.listen(PORT, () => {
  console.log(`🚀 API running on http://localhost:${PORT}`);
});
