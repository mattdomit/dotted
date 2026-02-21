import { Router } from "express";
import multer from "multer";
import { authenticate } from "../middleware/auth";
import { uploadFile, deleteFile, generateKey } from "../lib/s3";
import { AppError } from "../middleware/error-handler";

export const uploadRouter = Router();

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError("Only JPEG, PNG, and WebP images are allowed", 400) as any);
    }
  },
});

// POST / — upload a file
uploadRouter.post(
  "/",
  authenticate,
  upload.single("file"),
  async (req, res, next) => {
    try {
      if (!req.file) throw new AppError("No file provided", 400);

      const folder = (req.query.folder as string) || "general";
      const key = generateKey(folder, req.file.originalname);
      const url = await uploadFile(key, req.file.buffer, req.file.mimetype);

      if (!url) throw new AppError("File storage is not configured", 503);

      res.status(201).json({ success: true, data: { key, url } });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE / — delete a file by key
uploadRouter.delete("/", authenticate, async (req, res, next) => {
  try {
    const key = req.query.key as string;
    if (!key) throw new AppError("File key is required", 400);

    const deleted = await deleteFile(key);
    if (!deleted) throw new AppError("Failed to delete file", 500);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
