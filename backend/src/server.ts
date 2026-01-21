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

// 🟢 NEW: ระบบ Auto Backup (กันไฟล์หาย)
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const runBackup = () => {
  try {
    const now = new Date();
    // ตั้งชื่อโฟลเดอร์ตามเวลา: YYYYMMDD-HHmm (เช่น 20240121-1530)
    const timestamp = now.toISOString().replace(/[:T]/g, '-').slice(0, 16).replace(/\..+/, '');
    const currentBackupDir = path.join(BACKUP_DIR, timestamp);

    // สร้างโฟลเดอร์ Backup รอบนี้
    if (!fs.existsSync(currentBackupDir)) {
      fs.mkdirSync(currentBackupDir, { recursive: true });
    }

    // อ่านไฟล์ทั้งหมดใน data
    const files = fs.readdirSync(DATA_DIR);
    let count = 0;

    files.forEach(file => {
      const sourcePath = path.join(DATA_DIR, file);
      // เช็คว่าเป็นไฟล์ .tsv หรือไม่ (ไม่เอา folder backups และไม่เอาไฟล์เสียง)
      if (file.endsWith('.tsv') && fs.lstatSync(sourcePath).isFile()) {
        fs.copyFileSync(sourcePath, path.join(currentBackupDir, file));
        count++;
      }
    });

    if (count > 0) {
      console.log(`[Auto Backup] Saved ${count} files to backups/${timestamp}`);
    }

    // Cleanup: ลบ Backup เก่าทิ้ง (เก็บไว้แค่ 60 อันล่าสุด หรือ 1 ชม.)
    const allBackups = fs.readdirSync(BACKUP_DIR).sort();
    if (allBackups.length > 10) {
      const toDelete = allBackups.slice(0, allBackups.length - 10);
      toDelete.forEach(dirName => {
        try {
          fs.rmSync(path.join(BACKUP_DIR, dirName), { recursive: true, force: true });
          console.log(`[Auto Backup] Cleaned up old backup: ${dirName}`);
        } catch (e) {
          console.error(`[Auto Backup] Failed to delete ${dirName}`, e);
        }
      });
    }

  } catch (error) {
    console.error("[Auto Backup Error]", error);
  }
};

// สั่งให้ Backup ทำงานทุกๆ 1 นาที (60000 ms)
setInterval(runBackup, 60 * 1000);
// เรียกครั้งแรกทันทีตอนรัน server เพื่อความชัวร์
runBackup();

const getFilePath = (filename: string) => path.join(DATA_DIR, filename);

const app = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(express.json());

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

app.post('/api/tokenize', async (req, res) => {
  try {
    const { text } = req.body;
    const tokens = await tokenizeText(text || '');
    res.json(tokens);
  } catch (e) { res.json([]); }
});

app.post('/api/tokenize-batch', async (req, res) => {
  try {
    const { texts } = req.body;
    if (!texts || !Array.isArray(texts)) {
      return res.json([]);
    }

    try {
      const pythonUrl = process.env.PYTHON_API_URL || 'http://localhost:5000';
      const response = await fetch(`${pythonUrl}/api/tokenize-batch`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts })
      });
      
      if (response.ok) {
        const tokensList = await response.json();
        return res.json(tokensList);
      }
    } catch (error) {
      console.error("Python NLP batch service error, falling back to JS:", error);
    }

    const thaiSegmenter = new Intl.Segmenter('th', { granularity: 'word' });
    const results = texts.map(text => {
      try {
        if (!text) return [];
        return Array.from(thaiSegmenter.segment(text))
          .filter((seg) => seg.isWordLike)
          .map((seg) => seg.segment);
      } catch {
        return text.trim().split(/\s+/);
      }
    });
    
    res.json(results);

  } catch (e) {
    console.error("Batch tokenize error:", e);
    res.json([]); 
  }
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
  const { filename, key } = req.body;
  const filePath = getFilePath(filename);

  if (!fs.existsSync(filePath)) return res.send('File not found');

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const rows = content.split('\n');
    
    const header = rows[0];
    
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
      const match = file.match(/^(.+)-Correct\.tsv$/);
      
      if (match) {
        const userId = match[1];
        const filePath = path.join(DATA_DIR, file);
        
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n').filter(line => line.trim() !== '');
        const count = Math.max(0, lines.length - 1);
        
        stats.push({ user: userId, count });
      }
    });

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

app.post('/api/append-change', (req, res) => {
  const { original, changed, filename } = req.body;
  
  // 1. บันทึกลง ListOfChange.tsv (Log การทำงาน)
  const targetFile = filename || 'ListOfChange.tsv';
  const line = `\n${original}\t${changed}`;
  const filePath = getFilePath(targetFile);

  fs.appendFile(filePath, line, 'utf8', (err) => {
    if (err) return res.status(500).send('Error appending');

    // 🟢 2. NEW: ระบบ Auto-Learn (บันทึกลง Dictionary)
    const CUSTOM_DICT_PATH = path.join(__dirname, '..', 'custom_dict.txt');
    const wordsToAdd: string[] = [];

    // เพิ่มทั้งคำผิดและคำถูก เพื่อให้ครั้งหน้าตัดเป็นก้อนเดียวกันได้
    if (original && original.trim()) wordsToAdd.push(original.trim());
    if (changed && changed.trim()) wordsToAdd.push(changed.trim());

    if (wordsToAdd.length > 0) {
      const content = '\n' + wordsToAdd.join('\n');
      // appendFile จะสร้างไฟล์ให้เองถ้ายังไม่มี
      fs.appendFile(CUSTOM_DICT_PATH, content, 'utf8', (dictErr) => {
        if (dictErr) console.error("[Auto-Dict] Failed to update:", dictErr);
        else console.log(`[Auto-Dict] Learned: ${wordsToAdd.join(', ')}`);
      });
    }
    
    res.send('Appended & Updated Dict');
  });
});

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