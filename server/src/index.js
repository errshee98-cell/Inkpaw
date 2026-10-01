import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { connectDB } from './config/db.js';
import { requireAuth, requireCsrfHeader } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/errors.js';
import authRoutes from './routes/auth.js';
import entryRoutes from './routes/entries.js';
import attachmentRoutes from './routes/attachments.js';
import communityRoutes from './routes/community.js';
import settingsRoutes from './routes/settings.js';

for (const key of ['JWT_SECRET', 'ANON_SECRET', 'SALT_PEPPER']) {
  if (!process.env[key] || process.env[key].startsWith('change-me')) {
    if (process.env.NODE_ENV === 'production') throw new Error(`${key} must be set in production`);
    console.warn(`⚠ ${key} is not set — using an insecure development value`);
    process.env[key] = `dev-only-${key}`;
  }
}

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'same-site' },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'blob:', 'data:'],
          mediaSrc: ["'self'", 'blob:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
        },
      },
    })
  );
  app.use(
    cors({
      origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
      credentials: true,
      exposedHeaders: ['X-Attachment-Iv', 'X-Attachment-Meta', 'X-Attachment-Meta-Iv'],
    })
  );
  app.use(express.json({ limit: '3mb' }));
  app.use(cookieParser());
  if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));
  app.use('/api', rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));
  app.use('/api', requireCsrfHeader);

  app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));
  app.use('/api/auth', authRoutes);
  app.use('/api/entries', requireAuth, entryRoutes);
  app.use('/api/attachments', requireAuth, attachmentRoutes);
  app.use('/api/community', requireAuth, communityRoutes);
  app.use('/api/settings', requireAuth, settingsRoutes);
  app.use('/api', notFound);

  // In production, serve the built React app from the same origin.
  const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist, { maxAge: '1d', index: false }));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const port = Number(process.env.PORT) || 5000;
  await connectDB(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/inkpaw');
  createApp().listen(port, () => console.log(`✓ Inkpaw API on http://localhost:${port}`));
}
