import { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../lib/auth.js';
import { uploadLimiter } from '../lib/rateLimiters.js';

// Stockage en mémoire (pas sur disque) : le disque de Render est éphémère et
// perd son contenu à chaque redémarrage/redéploiement. Les fichiers sont
// persistés dans PostgreSQL (modèle UploadedFile) plutôt que sur le filesystem.
// Whitelist stricte de types raster : un SVG accepté ("image/*") peut embarquer du <script>
// et l'exécuter si son URL /uploads/:id est ouverte directement (hors <img>) — XSS stocké.
const ALLOWED_UPLOAD_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_UPLOAD_TYPES.has(file.mimetype)) return cb(new Error('Format non supporté. JPEG, PNG ou WebP uniquement.'));
    cb(null, true);
  },
});

const router = Router();

router.post('/api/upload', authMiddleware, uploadLimiter, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Erreur upload' });
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier' });
    try {
      const id = crypto.randomBytes(16).toString('hex');
      await prisma.uploadedFile.create({
        data: { id, mimeType: req.file.mimetype, data: req.file.buffer },
      });
      res.json({ url: `/uploads/${id}` });
    } catch {
      res.status(500).json({ error: "Erreur lors de l'enregistrement du fichier" });
    }
  });
});

router.get('/uploads/:filename', async (req, res) => {
  const file = await prisma.uploadedFile.findUnique({ where: { id: req.params.filename } });
  if (!file) return res.status(404).json({ error: 'Fichier non trouvé' });
  res.set('Content-Type', file.mimeType);
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(Buffer.from(file.data));
});

export default router;
