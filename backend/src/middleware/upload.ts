import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { randomUUID } from 'crypto';
import { UPLOAD_DIR } from '../config/env';

const incidentDir = path.join(process.cwd(), UPLOAD_DIR, 'incident-photos');
if (!fs.existsSync(incidentDir)) {
  fs.mkdirSync(incidentDir, { recursive: true });
}

const resolutionDir = path.join(process.cwd(), UPLOAD_DIR, 'resolutions');
if (!fs.existsSync(resolutionDir)) {
  fs.mkdirSync(resolutionDir, { recursive: true });
}

const idPhotoDir = path.join(process.cwd(), UPLOAD_DIR, 'id-photos');
if (!fs.existsSync(idPhotoDir)) {
  fs.mkdirSync(idPhotoDir, { recursive: true });
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

const resolutionStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, resolutionDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${Date.now()}-${randomUUID()}${ext}`);
  },
});

export const resolutionUpload = multer({
  storage: resolutionStorage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

const idStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, idPhotoDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${Date.now()}-${randomUUID()}${ext}`);
  },
});

export const idUpload = multer({
  storage: idStorage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

export const publicIncidentPath = (filename: string) => `/uploads/incident-photos/${filename}`;
export const publicResolutionPath = (filename: string) => `/uploads/resolutions/${filename}`;
