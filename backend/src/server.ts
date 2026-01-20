import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const getFilePath = (filename: string) => path.join(DATA_DIR, filename);

const app = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(express.json());

// const thaiSegmenter = new Intl.Segmenter('th', { granularity: 'word' });
// const tokenizeText = (text: string): string[] => {
//   if (!text) return [];
//   try {
//     return Array.from(thaiSegmenter.segment(text))
//       .filter((seg) => seg.isWordLike)
//       .map((seg) => seg.segment);
//   } catch (error) {
//     return text.trim().split(/\s+/);
//   }
// };
const tokenizeText = async (text: string): Promise<string[]> => {
  if (!text) return [];
  
  // 🟢 จุดที่แก้: เรียกไปที่ Python Service
  try {
    const pythonUrl = process.env.PYTHON_API_URL || 'http://localhost:5000';
    const response = await fetch(`${pythonUrl}/api/tokenize`, { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    
    if (response.ok) {
      const tokens = await response.json() as string[];
      return tokens;
    }
  } catch (error) {
    console.error("Python NLP service error, falling back to JS:", error);
  }

  // Fallback: ใช้ JS ตัดคำถ้า Python พัง
  try {
    const thaiSegmenter = new Intl.Segmenter('th', { granularity: 'word' });
    return Array.from(thaiSegmenter.segment(text))
      .filter((seg) => seg.isWordLike)
      .map((seg) => seg.segment);
  } catch (error) {
    return text.trim().split(/\s+/);
  }
};

// ⚠️ อย่าลืมแก้จุดที่เรียกใช้ tokenizeText ให้ใส่ await ด้วย
app.post('/api/tokenize', async (req, res) => { // ใส่ async
  try {
    const { text } = req.body;
    const tokens = await tokenizeText(text || ''); // ใส่ await
    res.json(tokens);
  } catch (e) { res.json([]); }
});



app.get('/api/load-file', (req, res) => {
  const filename = req.query.filename as string;
  const filePath = getFilePath(filename);
  if (fs.existsSync(filePath)) res.sendFile(filePath);
  else res.status(404).send('Not found');
});

// Save แบบทับไฟล์เดิม (สำหรับ Correct.tsv และ fail.tsv ตัวกลาง)
app.post('/api/save-file', (req, res) => {
  const { filename, content } = req.body;
  const filePath = getFilePath(filename);
  fs.writeFile(filePath, content, 'utf8', (err) => {
    if (err) res.status(500).send('Error');
    else res.send('Saved');
  });
});

// 🟢 NEW: Append TSV (สำหรับเก็บ Log ส่วนตัว แยกตาม User)
app.post('/api/append-tsv', (req, res) => {
  const { filename, item } = req.body; // item: { filename, text }
  const filePath = getFilePath(filename);
  
  try {
    let rows: {filename: string, text: string}[] = [];

    // 1. อ่านข้อมูลเก่าขึ้นมาเช็คก่อน
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      rows = content.split('\n')
        .slice(1) // ข้ามบรรทัด Header
        .filter(line => line.trim() !== '') // ตัดบรรทัดว่างทิ้ง
        .map(line => {
          // แยก filename กับ text ด้วย tab
          const parts = line.split('\t'); 
          // กันเหนียว: กรณี text มี tab ผสม ให้ join กลับคืน
          return { filename: parts[0], text: parts.slice(1).join('\t') };
        })
        .filter(row => row.filename); // เอาเฉพาะที่มีชื่อไฟล์
    }

    // 2. เช็คว่ามี filename นี้อยู่แล้วหรือยัง?
    const existingIndex = rows.findIndex(r => r.filename === item.filename);

    if (existingIndex !== -1) {
      // 2a. ถ้ามีแล้ว -> อัปเดตข้อความใหม่ทับอันเดิม
      rows[existingIndex].text = item.text;
    } else {
      // 2b. ถ้ายังไม่มี -> เพิ่มต่อท้าย
      rows.push({ filename: item.filename, text: item.text });
    }

    // 3. เขียนไฟล์ใหม่ทั้งหมด (Re-write)
    const header = 'filename\ttext';
    const newContent = header + '\n' + rows.map(r => `${r.filename}\t${r.text}`).join('\n');
    
    fs.writeFile(filePath, newContent, 'utf8', (err) => {
      if (err) {
        console.error("Write error:", err);
        res.status(500).send('Error saving');
      } else {
        res.send('Saved (Upsert)');
      }
    });

  } catch (err) {
    console.error("Server error:", err);
    res.status(500).send('Server Error');
  }
});

// 🟢 NEW API: ลบข้อมูลออกจากไฟล์ TSV (สำหรับปุ่ม X)
app.post('/api/delete-tsv-entry', (req, res) => {
  const { filename, key } = req.body; // key คือชื่อไฟล์เสียงที่ต้องการลบ
  const filePath = getFilePath(filename);

  if (!fs.existsSync(filePath)) return res.send('File not found');

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const rows = content.split('\n');
    
    // เก็บ Header ไว้ (filename \t text)
    const header = rows[0];
    
    // กรองเอาแถวที่ "ชื่อไฟล์เสียง" (col 0) ไม่ตรงกับ key
    // พูดง่ายๆ คือ เอาเฉพาะตัวที่ไม่ใช่ตัวที่จะลบ
    const newRows = rows.slice(1).filter(line => {
      const parts = line.split('\t');
      return parts[0] !== key && line.trim() !== '';
    });

    const newContent = header + '\n' + newRows.join('\n');
    
    fs.writeFileSync(filePath, newContent, 'utf8');
    res.send('Deleted');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error deleting');
  }
});

app.get(/^\/api\/audio\/(.*)$/, (req, res) => {
  const params = req.params as any;
  const rawPath = params[0] || '';
  const audioPath = decodeURIComponent(rawPath);
  if (fs.existsSync(audioPath)) res.sendFile(audioPath);
  else res.status(404).send('Not found');
});

// 🟢 NEW: API สำหรับดึงสถิติ Dashboard
app.get('/api/dashboard-stats', (req, res) => {
  try {
    if (!fs.existsSync(DATA_DIR)) return res.json([]);
    
    const files = fs.readdirSync(DATA_DIR);
    const stats: { user: string; count: number }[] = [];

    files.forEach(file => {
      // ค้นหาไฟล์ที่มีรูปแบบ: {ชื่อพนักงาน}-Correct.tsv
      // (ไม่นับไฟล์ Correct.tsv กลาง เพราะอันนั้นเป็นผลรวม)
      const match = file.match(/^(.+)-Correct\.tsv$/);
      
      if (match) {
        const userId = match[1]; // ชื่อพนักงาน เช่น EMP001
        const filePath = path.join(DATA_DIR, file);
        
        // อ่านไฟล์และนับบรรทัด
        const content = fs.readFileSync(filePath, 'utf8');
        // กรองบรรทัดว่างออก และลบ 1 (Header)
        const lines = content.split('\n').filter(line => line.trim() !== '');
        const count = Math.max(0, lines.length - 1);
        
        stats.push({ user: userId, count });
      }
    });

    // เรียงลำดับจากมากไปน้อย
    stats.sort((a, b) => b.count - a.count);
    
    res.json(stats);
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json([]);
  }
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

// สำหรับ ListOfChange (ใช้ append-change เหมือนเดิมก็ได้ หรือจะใช้ append-tsv ก็ได้ แต่แยกไว้เพื่อความชัดเจน)
app.post('/api/append-change', (req, res) => {
  const { original, changed, filename } = req.body;
  const targetFile = filename || 'ListOfChange.tsv';
  const line = `\n${original}\t${changed}`;
  const filePath = getFilePath(targetFile);

  fs.appendFile(filePath, line, 'utf8', (err) => {
    if (err) res.status(500).send('Error appending');
    else res.send('Appended');
  });
});

// 🟢 NEW: API เช็คเวลาการแก้ไขล่าสุดของไฟล์ (สำหรับ Smart Polling)
app.get('/api/check-mtime', (req, res) => {
  const filename = req.query.filename as string;
  const filePath = getFilePath(filename);
  if (fs.existsSync(filePath)) {
    const mtime = fs.statSync(filePath).mtime.getTime();
    res.json({ mtime });
  } else {
    res.json({ mtime: 0 });
  }
});

app.listen(PORT, () => {
  console.log(`Server running: http://10.2.98.118:3003:${PORT}`);
});