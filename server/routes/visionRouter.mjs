// POST /api/vision/annotate —— 上传图像 + 批注 → modlens 视觉结构化结果
import { Router } from 'express';
import multer from 'multer';
import { analyzeImage, buildContextMessage } from '../services/visionBridge.mjs';

const upload = multer({ dest: 'tmp/vision-uploads/', limits: { fileSize: 12 * 1024 * 1024 } });
export const visionRouter = Router();

visionRouter.post('/annotate', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'image file required (field "image")' });
    const annotations = (() => { try { return JSON.parse(req.body.annotations || '[]'); } catch { return []; } })();
    const prompt = req.body.prompt || '';
    const result = await analyzeImage({ imagePath: req.file.path, prompt });
    const contextMessage = buildContextMessage({ result, annotations });
    res.json({ ok: true, contextMessage, raw: result });
  } catch (e) {
    res.status(500).json({ error: e?.message || 'analyze failed' });
  }
});
