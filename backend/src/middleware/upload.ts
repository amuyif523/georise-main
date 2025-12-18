import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { randomUUID } from 'crypto';
import { UPLOAD_DIR } from '../config/env';

const incidentDir = path.join(process.cwd(), UPLOAD_DIR, 'incident-photos');
if (!fs.existsSync(incidentDir)) {
  fs.mkdirSync(incidentDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, incidentDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${Date.now()}-${randomUUID()}${ext}`);
  },
});

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (!file.mimetype.startsWith('image/')) {
    return cb(new Error('Only image uploads are allowed'));
  }
  cb(null, true);
};

export const incidentUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

export const publicIncidentPath = (filename: string) => `/uploads/incident-photos/${filename}`;
