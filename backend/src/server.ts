import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// --- 1. ระบบตัดคำ Native (เร็วที่สุดในโลก Node.js) ---
const thaiSegmenter = new Intl.Segmenter('th', { granularity: 'word' });

const tokenizeText = (text: string): string[] => {
  if (!text) return [];
  try {
    return Array.from(thaiSegmenter.segment(text))
      .filter((seg) => seg.isWordLike)
      .map((seg) => seg.segment);
  } catch (error) {
    // Fallback เผื่อรันบน Node รุ่นเก่าจริงๆ
    return text.trim().split(/\s+/);
  }
};

// --- API Endpoints ---
app.post('/api/tokenize', (req, res) => {
  try {
    const { text } = req.body;
    res.json(tokenizeText(text || ''));
  } catch (e) { res.json([]); }
});

app.get('/api/load-file', (req, res) => {
  const filename = req.query.filename as string;
  const filePath = path.join(__dirname, '..', filename);
  if (fs.existsSync(filePath)) res.sendFile(filePath);
  else res.status(404).send('Not found');
});

app.post('/api/save-file', (req, res) => {
  const { filename, content } = req.body;
  const filePath = path.join(__dirname, '..', filename);
  fs.writeFile(filePath, content, 'utf8', (err) => {
    if (err) res.status(500).send('Error');
    else res.send('Saved');
  });
});

app.get(/^\/api\/audio\/(.*)$/, (req, res) => {
  const params = req.params as any;
  
  // params[0] จะเก็บค่า Path ทั้งหมดที่ Regex จับได้
  const rawPath = params[0] || '';
  const audioPath = decodeURIComponent(rawPath);
  
  if (fs.existsSync(audioPath)) res.sendFile(audioPath);
  else res.status(404).send('Not found');
});

app.post('/api/scan-audio', (req, res) => {
  const { path: dirPath } = req.body;
  if (!fs.existsSync(dirPath)) return res.status(404).send('Not found');
  
  const results: string[] = [];
  function scan(dir: string) {
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) scan(fullPath);
        else if (/\.(wav|mp3|m4a)$/i.test(file)) results.push(fullPath);
      }
    } catch {}
  }
  scan(dirPath);
  res.json(results);
});

// 🟢 API ใหม่: ต่อท้ายไฟล์ (สำหรับ ListOfChange) ป้องกันการทับกัน
app.post('/api/append-change', (req, res) => {
  const { original, changed } = req.body;
  // จัด Format ให้เป็น TSV: ขึ้นบรรทัดใหม่ + คำผิด + แท็บ + คำถูก
  const line = `\n${original}\t${changed}`;
  
  // ใช้ appendFile เพื่อ "ต่อท้าย" ไฟล์เดิม (ไม่ทับของเก่า)
  const filePath = path.join(__dirname, '..', 'ListOfChange.tsv'); 
  fs.appendFile(filePath, line, 'utf8', (err) => {
    if (err) res.status(500).send('Error appending');
    else res.send('Appended');
  });
});

app.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}`);
  console.log('Tokenizer: Native Intl.Segmenter (Active)');
});