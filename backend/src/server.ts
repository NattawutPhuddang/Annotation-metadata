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

// 🟢 NEW: ระบบ Auto Backup (Updated: เป็น Async เพื่อไม่ให้ Server กระตุก)
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}
const CUSTOM_DICT_PATH = path.join(DATA_DIR, 'custom_dict.txt');

// 🔒 MUTEX LOCK: กันข้อมูลชนกัน (Simple In-Memory Lock)
const fileLocks: Record<string, boolean> = {};
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const acquireLock = async (filePath: string) => {
  let retries = 0;
  while (fileLocks[filePath] && retries < 100) { // รอสูงสุด 5 วินาที
    await wait(50);
    retries++;
  }
  fileLocks[filePath] = true;
};

const releaseLock = (filePath: string) => {
  delete fileLocks[filePath];
};

const runBackup = async () => {
  try {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:T]/g, '-').slice(0, 16).replace(/\..+/, '');
    const currentBackupDir = path.join(BACKUP_DIR, timestamp);

    // ใช้ fs.promises เพื่อไม่ให้ Block การทำงานหลัก
    try {
        await fs.promises.access(currentBackupDir);
    } catch {
        await fs.promises.mkdir(currentBackupDir, { recursive: true });
    }

    const files = await fs.promises.readdir(DATA_DIR);
    let count = 0;

    for (const file of files) {
      const sourcePath = path.join(DATA_DIR, file);
      // เช็คว่าเป็นไฟล์ .tsv หรือไม่
      if (file.endsWith('.tsv')) {
         const stats = await fs.promises.lstat(sourcePath);
         if (stats.isFile()) {
            await fs.promises.copyFile(sourcePath, path.join(currentBackupDir, file));
            count++;
         }
      }
    }

    if (count > 0) {
      console.log(`[Auto Backup] Saved ${count} files to backups/${timestamp}`);
    }

    // Cleanup: ลบ Backup เก่าทิ้ง (เก็บไว้ 10 อันล่าสุด)
    const allBackups = (await fs.promises.readdir(BACKUP_DIR)).sort();
    if (allBackups.length > 10) {
      const toDelete = allBackups.slice(0, allBackups.length - 10);
      for (const dirName of toDelete) {
        try {
          await fs.promises.rm(path.join(BACKUP_DIR, dirName), { recursive: true, force: true });
          console.log(`[Auto Backup] Cleaned up old backup: ${dirName}`);
        } catch (e) {
          console.error(`[Auto Backup] Failed to delete ${dirName}`, e);
        }
      }
    }

  } catch (error) {
    console.error("[Auto Backup Error]", error);
  }
};

// สั่งให้ Backup ทำงานทุกๆ 1 นาที (60000 ms)
setInterval(runBackup, 60 * 1000);
// เรียกครั้งแรก (แบบ fire-and-forget ไม่ต้อง await)
runBackup();

// 🛡️ SECURITY FIX: ป้องกัน Path Traversal
const getFilePath = (filename: string) => {
  // Normalize path เพื่อแก้พวก .. (เช่น ../../etc/passwd)
  const safePath = path.normalize(path.join(DATA_DIR, filename));
  // ตรวจสอบว่า path สุดท้ายต้องยังขึ้นต้นด้วย DATA_DIR เท่านั้น
  if (!safePath.startsWith(path.resolve(DATA_DIR))) {
    throw new Error("Security Error: Access Denied (Path Traversal Detected)");
  }
  return safePath;
};

const app = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(express.json());

const tokenizeText = async (text: string): Promise<string[]> => {
  if (!text) return [];
  
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

app.get('/api/load-file', async (req, res) => {
  try {
    const filename = req.query.filename as string;
    const filePath = getFilePath(filename);
    
    // ใช้ async access แทน existsSync
    try {
        await fs.promises.access(filePath);
        res.sendFile(filePath);
    } catch {
        res.status(404).send('Not found');
    }
  } catch (err: any) {
    res.status(403).send(err.message);
  }
});

// ✅ FIX: ใส่ Lock และใช้ Async Write
app.post('/api/save-file', async (req, res) => {
  const { filename, content } = req.body;
  try {
    const filePath = getFilePath(filename);
    
    await acquireLock(filePath); // 🔒 Lock
    try {
        await fs.promises.writeFile(filePath, content, 'utf8');
        res.send('Saved');
    } finally {
        releaseLock(filePath); // 🔓 Unlock เสมอไม่ว่าจะ error หรือไม่
    }
  } catch (err: any) {
    console.error(err);
    if (err.message.includes("Security")) return res.status(403).send(err.message);
    res.status(500).send('Error');
  }
});

// ✅ FIX: ใส่ Lock + Async Read/Write ป้องกัน Race Condition
app.post('/api/append-tsv', async (req, res) => {
  const { filename, item } = req.body; 
  
  try {
    const filePath = getFilePath(filename);

    await acquireLock(filePath); // 🔒 Lock
    try {
        let rows: {filename: string, text: string}[] = [];

        // 1. อ่านข้อมูลเก่า (Async)
        try {
            const content = await fs.promises.readFile(filePath, 'utf8');
            rows = content.split('\n')
                .slice(1)
                .filter(line => line.trim() !== '')
                .map(line => {
                const parts = line.split('\t'); 
                return { filename: parts[0], text: parts.slice(1).join('\t') };
                })
                .filter(row => row.filename);
        } catch (readErr) {
            // ถ้าไฟล์ยังไม่มี ให้ถือว่าเป็น array ว่าง
        }

        // 2. Update Logic
        const existingIndex = rows.findIndex(r => r.filename === item.filename);
        if (existingIndex !== -1) {
            rows[existingIndex].text = item.text;
        } else {
            rows.push({ filename: item.filename, text: item.text });
        }

        // 3. เขียนไฟล์ (Async)
        const header = 'filename\ttext';
        const newContent = header + '\n' + rows.map(r => `${r.filename}\t${r.text}`).join('\n');
        
        await fs.promises.writeFile(filePath, newContent, 'utf8');
        res.send('Saved (Upsert)');

    } finally {
        releaseLock(filePath); // 🔓 Unlock
    }

  } catch (err: any) {
    console.error("Server error:", err);
    if (err.message.includes("Security")) return res.status(403).send(err.message);
    res.status(500).send('Server Error');
  }
});

// ✅ FIX: ใส่ Lock + Async
app.post('/api/delete-tsv-entry', async (req, res) => {
  const { filename, key } = req.body;
  
  try {
    const filePath = getFilePath(filename);

    await acquireLock(filePath); // 🔒 Lock
    try {
        // เช็คว่าไฟล์มีไหม
        try {
             await fs.promises.access(filePath);
        } catch {
             return res.send('File not found');
        }

        const content = await fs.promises.readFile(filePath, 'utf8');
        const rows = content.split('\n');
        
        const header = rows[0];
        const newRows = rows.slice(1).filter(line => {
            const parts = line.split('\t');
            return parts[0] !== key && line.trim() !== '';
        });

        const newContent = header + '\n' + newRows.join('\n');
        
        await fs.promises.writeFile(filePath, newContent, 'utf8');
        res.send('Deleted');

    } finally {
        releaseLock(filePath); // 🔓 Unlock
    }
  } catch (err: any) {
    console.error(err);
    if (err.message.includes("Security")) return res.status(403).send(err.message);
    res.status(500).send('Error deleting');
  }
});

app.get(/^\/api\/audio\/(.*)$/, async (req, res) => {
  const params = req.params as any;
  const rawPath = params[0] || '';
  const audioPath = decodeURIComponent(rawPath);
  
  try {
      // Security Check: ห้าม Audio ออกนอก DATA_DIR หรือโฟลเดอร์ที่กำหนด (ถ้า audio อยู่นอก data ต้องแก้ logic ตรงนี้)
      // แต่เบื้องต้นเช็ค existence ก่อน
      if (fs.existsSync(audioPath)) {
          // ถ้าเป็นไปได้ควรเช็ค Path Traversal ตรงนี้ด้วยถ้า audioPath มาจาก user input
          res.sendFile(audioPath); 
      } else {
          res.status(404).send('Not found');
      }
  } catch {
      res.status(404).send('Not found');
  }
});

// ✅ FIX: Async Dashboard Stats
app.get('/api/dashboard-stats', async (req, res) => {
  try {
    if (!fs.existsSync(DATA_DIR)) return res.json([]);
    
    const files = await fs.promises.readdir(DATA_DIR);
    const stats: { user: string; count: number }[] = [];

    // ใช้ Promise.all เพื่ออ่านไฟล์หลายไฟล์พร้อมกัน (Parallel) เร็วกว่าเดิม
    await Promise.all(files.map(async (file) => {
      const match = file.match(/^(.+)-Correct\.tsv$/);
      if (match) {
        const userId = match[1];
        const filePath = path.join(DATA_DIR, file);
        
        try {
            const content = await fs.promises.readFile(filePath, 'utf8');
            const lines = content.split('\n').filter(line => line.trim() !== '');
            const count = Math.max(0, lines.length - 1);
            stats.push({ user: userId, count });
        } catch (e) {
            // กรณีอ่านไฟล์ไม่ผ่าน ข้ามไป
        }
      }
    }));

    stats.sort((a, b) => b.count - a.count);
    res.json(stats);
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json([]);
  }
});

// ✅ FIX: Async Recursive Scan (Non-blocking)
app.post('/api/scan-audio', async (req, res) => {
  const { path: dirPath } = req.body;
  if (!fs.existsSync(dirPath)) return res.status(404).send('Not found');
  
  // Recursive function แบบ Async
  async function getFiles(dir: string): Promise<string[]> {
    let results: string[] = [];
    try {
        const dirents = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const dirent of dirents) {
            const fullPath = path.resolve(dir, dirent.name);
            if (dirent.isDirectory()) {
                results = results.concat(await getFiles(fullPath));
            } else if (/\.(wav|mp3|m4a)$/i.test(dirent.name)) {
                results.push(fullPath);
            }
        }
    } catch {}
    return results;
  }

  const results = await getFiles(dirPath);
  res.json(results);
});

app.post('/api/append-change', async (req, res) => {
  const { original, changed, filename } = req.body;
  
  try {
    const targetFile = filename || 'ListOfChange.tsv';
    const filePath = getFilePath(targetFile); // Security Check
    const line = `\n${original}\t${changed}`;

    // 1. Append Change
    await fs.promises.appendFile(filePath, line, 'utf8');

    // 2. Auto-Learn Dict
    const wordsToAdd: string[] = [];
    if (original && original.trim()) wordsToAdd.push(original.trim());
    if (changed && changed.trim()) wordsToAdd.push(changed.trim());

    if (wordsToAdd.length > 0) {
      const content = '\n' + wordsToAdd.join('\n');
      // Append Dict (ไม่ซีเรียสเรื่อง Race Condition มากนักสำหรับ Dict แต่ใช้ promises ก็ดี)
      try {
          await fs.promises.appendFile(CUSTOM_DICT_PATH, content, 'utf8');
          console.log(`[Auto-Dict] Learned: ${wordsToAdd.join(', ')}`);
      } catch (dictErr) {
          console.error("[Auto-Dict] Failed to update:", dictErr);
      }
    }
    
    res.send('Appended & Updated Dict');

  } catch (err: any) {
    if (err.message.includes("Security")) return res.status(403).send(err.message);
    res.status(500).send('Error appending');
  }
});

app.get('/api/check-mtime', async (req, res) => {
  try {
    const filename = req.query.filename as string;
    const filePath = getFilePath(filename);
    
    try {
        const stats = await fs.promises.stat(filePath);
        res.json({ mtime: stats.mtime.getTime() });
    } catch {
        res.json({ mtime: 0 });
    }
  } catch (err) {
    res.json({ mtime: 0 });
  }
});

app.listen(PORT, () => {
  console.log(`Server running: http://10.2.98.118:3003:${PORT}`);
});