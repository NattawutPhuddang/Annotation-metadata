import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// --- 1. ระบบตัดคำแบบ Native (ไม่ต้องง้อ Python) ---
// ใช้ Intl.Segmenter ที่ติดมากับ Node.js (v16+) เร็วและแม่นยำ
const thaiSegmenter = new Intl.Segmenter('th', { granularity: 'word' });

const tokenizeText = (text: string): string[] => {
  if (!text) return [];
  try {
    return Array.from(thaiSegmenter.segment(text))
      .filter((seg) => seg.isWordLike) // กรองเอาเฉพาะคำ
      .map((seg) => seg.segment);
  } catch (error) {
    console.error("Intl.Segmenter error (Using fallback):", error);
    // กรณี Node.js รุ่นเก่ามาก ให้ใช้การเว้นวรรคแทน
    return text.trim().split(/\s+/);
  }
};

// --- API Endpoints ---

app.post('/api/tokenize', (req, res) => {
  try {
    const { text } = req.body;
    const tokens = tokenizeText(text || '');
    res.json(tokens);
  } catch (error) {
    console.error('Tokenize error:', error);
    res.json([]);
  }
});

app.get('/api/load-file', (req, res) => {
  const filename = req.query.filename as string;
  if (!filename) return res.status(400).send('Missing filename');
  
  const filePath = path.join(__dirname, '..', filename);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('File not found');
  }
});

app.post('/api/save-file', (req, res) => {
  const { filename, content } = req.body;
  if (!filename || content === undefined) return res.status(400).send('Missing data');
  
  const filePath = path.join(__dirname, '..', filename);
  fs.writeFile(filePath, content, 'utf8', (err) => {
    if (err) {
      console.error('Save error:', err);
      res.status(500).send('Error saving file');
    } else {
      res.send('File saved');
    }
  });
});

app.get('/api/audio/:path*', (req, res) => {
  // แก้ TypeScript Error และ Decode Path ให้ถูกต้อง
  const params = req.params as any;
  const rawPath = (params.path || '') + (params[0] || '');
  const audioPath = decodeURIComponent(rawPath);
  
  if (fs.existsSync(audioPath)) {
    res.sendFile(audioPath);
  } else {
    res.status(404).send('Audio not found');
  }
});

app.post('/api/scan-audio', (req, res) => {
  const { path: dirPath } = req.body;
  
  if (!fs.existsSync(dirPath)) return res.status(404).send('Directory not found');
  
  const results: string[] = [];
  function scan(dir: string) {
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          scan(fullPath);
        } else if (file.toLowerCase().endsWith('.wav') || file.toLowerCase().endsWith('.mp3')) {
          results.push(fullPath);
        }
      }
    } catch (err) {}
  }
  
  try {
    scan(dirPath);
    res.json(results);
  } catch (e) {
    res.status(500).send('Error scanning');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Tokenizer: Native Node.js Intl.Segmenter (Ready & Fast)');
});