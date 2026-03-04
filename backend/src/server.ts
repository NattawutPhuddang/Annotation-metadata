import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();


// 1. ตั้งค่า Config (ควรย้ายไปใส่ .env)
const LARK_APP_ID = process.env.LARK_APP_ID || 'cli_a9f6e14d6f381ed2'; 
const LARK_APP_SECRET = process.env.LARK_APP_SECRET || 'PoZAUcaQeypNSUIJBwUr7g8jMyohnp0C'; 
const LARK_BASE_TOKEN = process.env.LARK_BASE_TOKEN || 'TZTmbSaLva5U9rs8uEnlaHzGgjd'; // ดูจาก URL หลัง /base/
const LARK_TABLE_ID = process.env.LARK_TABLE_ID || 'tblBEdpZE5OMDZgy'; // ดูจาก URL หลัง /table/
let larkAccessToken = '';
let tokenExpire = 0;

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 🟢 NEW: ระบบ Auto Backup (Updated: เป็น Async เพื่อไม่ให้ Server กระตุก)
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}
const SAVES_DIR = path.join(DATA_DIR, 'saves');
if (!fs.existsSync(SAVES_DIR)) {
  fs.mkdirSync(SAVES_DIR, { recursive: true });
}
const CUSTOM_DICT_PATH = path.join(DATA_DIR, 'custom_dict.txt');

// 🔒 MUTEX LOCK: กันข้อมูลชนกัน (Simple In-Memory Lock)
const fileLocks: Record<string, boolean> = {};
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const ANNOUNCE_PATH = path.join(DATA_DIR, 'announcement.json');

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
setInterval(runBackup, 120 * 1000);
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
    const pythonUrl = process.env.PYTHON_API_URL || 'http://localhost:5001';
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

// ฟังก์ชันขอ Token จาก Lark (ใช้ซ้ำได้จนกว่าจะหมดอายุ)
const getLarkToken = async () => {
  const now = Math.floor(Date.now() / 1000);
  if (larkAccessToken && now < tokenExpire) return larkAccessToken;

  try {
    const res = await axios.post('https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal', {
      app_id: LARK_APP_ID,
      app_secret: LARK_APP_SECRET
    });
    larkAccessToken = res.data.tenant_access_token;
    tokenExpire = now + res.data.expire - 60; // เผื่อเวลา 60 วิ
    return larkAccessToken;
  } catch (e) {
    console.error('[Lark Auth Error]', e);
    return null;
  }
};

// ฟังก์ชันหลัก: Sync ข้อมูลลง Lark
const syncStatsToLark = async () => {
  try {
    const token = await getLarkToken();
    if (!token) return;

    // 1. รวบรวมข้อมูล Correct รายบุคคล (เหมือนเดิม)
    const files = await fs.promises.readdir(DATA_DIR);
    const userStats: Record<string, { correct: number, fail: number }> = {};

    for (const file of files) {
      const match = file.match(/^(.+)-Correct\.tsv$/);
      if (match) {
        const userId = match[1];
        const content = await fs.promises.readFile(path.join(DATA_DIR, file), 'utf8');
        const count = Math.max(0, content.split('\n').filter(l => l.trim()).length - 1);
        
        if (!userStats[userId]) userStats[userId] = { correct: 0, fail: 0 };
        userStats[userId].correct = count;
      }
    }

    // 2. อ่านยอด Fail รวม (เหมือนเดิม)
    let globalFailCount = 0;
    try {
        const failPath = path.join(DATA_DIR, 'fail.tsv');
        const failContent = await fs.promises.readFile(failPath, 'utf8');
        globalFailCount = Math.max(0, failContent.split('\n').filter(l => l.trim()).length - 1);
    } catch (e) {}

    // 🟢 3. NEW: อ่านยอด Correct รวม (จาก Correct.tsv) เพื่อส่งเข้าช่อง "Total"
    let globalTotalCorrect = 0;
    try {
        const totalCorrectPath = path.join(DATA_DIR, 'Correct.tsv');
        const totalContent = await fs.promises.readFile(totalCorrectPath, 'utf8');
        globalTotalCorrect = Math.max(0, totalContent.split('\n').filter(l => l.trim()).length - 1);
        console.log(`[Lark Sync] Global Correct (Total): ${globalTotalCorrect}`);
    } catch (e) {}

    // 4. เตรียมตัวแปรวันที่ (Timezone ไทย)
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
    const todayTimestamp = Date.now();

    // 5. วนลูป User เพื่อ Sync ลง Lark
    for (const [userId, stat] of Object.entries(userStats)) {
        
        stat.fail = globalFailCount;

        // ค้นหาแถวของ User นี้
        const filterFormula = `CurrentValue.[User]="${userId}"`;
        const listUrl = `https://open.larksuite.com/open-apis/bitable/v1/apps/${LARK_BASE_TOKEN}/tables/${LARK_TABLE_ID}/records?filter=${encodeURIComponent(filterFormula)}&sort=%5B%22Date%20DESC%22%5D`;

        let targetRecordId = null;
        let dbCorrect = -1;
        let dbFail = -1;
        let dbTotal = -1;

        try {
            const searchRes = await axios.get(listUrl, { headers: { Authorization: `Bearer ${token}` } });

            if (searchRes.data.code === 0 && searchRes.data.data && searchRes.data.data.items) {
                const items = searchRes.data.data.items;
                for (const item of items) {
                    const itemDateVal = item.fields['Date'];
                    if (!itemDateVal) continue;
                    const itemDateStr = new Date(itemDateVal).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });

                    if (itemDateStr === todayStr) {
                        targetRecordId = item.record_id;
                        dbCorrect = item.fields['Correct'] || 0;
                        dbFail = item.fields['Fail'] || 0;
                        dbTotal = item.fields['Total'] || 0; // รับค่าเดิมมาเช็ค
                        break; 
                    }
                }
            }
        } catch (searchErr) {
             console.error(`[Lark Search Error] User: ${userId}`, searchErr);
             continue;
        }

        // ข้อมูลที่จะส่งไปอัปเดต
        const fieldsToUpdate = {
            "Correct": stat.correct,   // ยอดรายคน
            "Fail": stat.fail,         // ยอด Fail รวม
            "Total": globalTotalCorrect // ✅ ยอด Correct รวม (ส่งค่าเดียวกันให้ทุกคน)
        };

        if (targetRecordId) {
            // --- UPDATE (ถ้าตัวเลขเปลี่ยน) ---
            if (dbCorrect !== stat.correct || dbFail !== stat.fail || dbTotal !== globalTotalCorrect) {
                 await axios.put(
                    `https://open.larksuite.com/open-apis/bitable/v1/apps/${LARK_BASE_TOKEN}/tables/${LARK_TABLE_ID}/records/${targetRecordId}`,
                    { fields: fieldsToUpdate },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                console.log(`[Lark Sync] Updated ${userId}`);
            }
        } else {
            // --- CREATE (วันใหม่) ---
            await axios.post(
                `https://open.larksuite.com/open-apis/bitable/v1/apps/${LARK_BASE_TOKEN}/tables/${LARK_TABLE_ID}/records`,
                {
                    fields: {
                        "Date": todayTimestamp, 
                        "User": userId,
                        ...fieldsToUpdate // ส่งทั้ง Correct, Fail, Total
                    }
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            console.log(`[Lark Sync] Created new row for ${userId}`);
        }
    }

  } catch (e: any) {
    const errorData = e.response?.data || e.message;
    console.error("[Lark Sync Error Details]:", JSON.stringify(errorData, null, 2));
  }
};

// ตั้งเวลาให้ Sync ทุกๆ 5 นาที (300000 ms)
// ไม่ควรถี่เกินไปเพราะ Lark มี Rate Limit
setInterval(syncStatsToLark, 0.5 * 60 * 1000);

// หรือจะสร้าง API ให้กด Trigger เองก็ได้
app.post('/api/trigger-sync', async (req, res) => {
    syncStatsToLark(); // Run background
    res.send('Sync started');
});

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
      const pythonUrl = process.env.PYTHON_API_URL || 'http://localhost:5001';
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

// ✅ แก้ไขส่วนรับไฟล์เสียงใน server.ts
app.get('/api/audio', async (req, res) => {
  try {
    const rawPath = req.query.path as string;
    // รับ basePath เพิ่มมาจาก query string
    const basePath = req.query.basePath as string; 

    if (!rawPath) return res.status(400).send('Path is required');

    const decodedPath = decodeURIComponent(rawPath);
    
    // ถ้ามี basePath ส่งมา ให้ใช้ค่านั้นเป็นตัวตั้งต้น ถ้าไม่มีให้ใช้ค่าว่าง
    const finalPath = basePath 
      ? path.join(decodeURIComponent(basePath), decodedPath)
      : path.resolve(decodedPath);

    console.log(`[Target Path]: ${finalPath}`);

    await fs.promises.access(finalPath, fs.constants.R_OK);
    res.sendFile(finalPath);
  } catch (err) {
    console.error(`[Audio Error]: ${err}`);
    res.status(404).send('Audio file not found');
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

// ✅ Move to Trash - Move item to trash.tsv and remove from correct/fail
app.post('/api/move-to-trash', async (req, res) => {
  const { filename, sourceFile } = req.body;
  
  try {
    const sourceFilePath = getFilePath(sourceFile || 'Correct.tsv');
    const trashFilePath = getFilePath('trash.tsv');

    await acquireLock(sourceFilePath);
    await acquireLock(trashFilePath);
    
    try {
      // 1. Read source file & Remove item (เหมือนเดิม)
      let itemToTrash = null;
      let rows: {filename: string, text: string}[] = [];
      
      try {
        const content = await fs.promises.readFile(sourceFilePath, 'utf8');
        const lines = content.split('\n');
        const header = lines[0];
        
        rows = lines
          .slice(1)
          .filter(line => line.trim() !== '')
          .map(line => {
            const parts = line.split('\t');
            return { filename: parts[0], text: parts.slice(1).join('\t') };
          })
          .filter(row => row.filename);
        
        const index = rows.findIndex(r => r.filename === filename);
        if (index !== -1) {
          itemToTrash = rows[index];
          rows.splice(index, 1);
        }
      } catch (readErr) {
        return res.status(404).send('Source file not found');
      }

      if (!itemToTrash) {
        return res.status(404).send('Item not found');
      }

      // 2. Write back to source file (เหมือนเดิม)
      const newContent = 'filename\ttext\n' + rows.map(r => `${r.filename}\t${r.text}`).join('\n');
      await fs.promises.writeFile(sourceFilePath, newContent, 'utf8');

      // 3. Append/Update trash.tsv (🔴 แก้ไขตรงนี้)
      try {
        const trashContent = await fs.promises.readFile(trashFilePath, 'utf8');
        const trashRows = trashContent.split('\n')
          .slice(1)
          .filter(line => line.trim() !== '')
          .map(line => {
            const parts = line.split('\t');
            return { filename: parts[0], text: parts.slice(1).join('\t') };
          })
          .filter(row => row.filename);
        
        // ✅ FIX: เช็คก่อนว่ามีไหม ถ้ามีให้ทับ ถ้าไม่มีให้เพิ่ม
        const existingIdx = trashRows.findIndex(r => r.filename === itemToTrash.filename);
        if (existingIdx !== -1) {
            trashRows[existingIdx] = itemToTrash; // Update
        } else {
            trashRows.push(itemToTrash); // Insert
        }

        const newTrashContent = 'filename\ttext\n' + trashRows.map(r => `${r.filename}\t${r.text}`).join('\n');
        await fs.promises.writeFile(trashFilePath, newTrashContent, 'utf8');

      } catch (trashErr) {
        // ถ้ายังไม่มีไฟล์ Trash ให้สร้างใหม่
        const newTrashContent = 'filename\ttext\n' + `${itemToTrash.filename}\t${itemToTrash.text}`;
        await fs.promises.writeFile(trashFilePath, newTrashContent, 'utf8');
      }

      res.json({ success: true, message: 'Moved to trash' });

    } finally {
      releaseLock(sourceFilePath);
      releaseLock(trashFilePath);
    }

  } catch (err: any) {
    console.error('Move to trash error:', err);
    if (err.message.includes("Security")) return res.status(403).send(err.message);
    res.status(500).send('Error moving to trash');
  }
});

app.post('/api/game/save', async (req, res) => {
  const { userId, data } = req.body;
  if (!userId || !data) return res.status(400).send('Missing userId or data');

  try {
    // Validate userId (ป้องกัน path traversal)
    if (!/^[a-zA-Z0-9_-]+$/.test(userId)) {
        return res.status(400).send('Invalid userId format');
    }

    const filePath = path.join(SAVES_DIR, `${userId}.json`);
    
    await acquireLock(filePath);
    try {
        await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
        res.send('Game Saved');
    } finally {
        releaseLock(filePath);
    }
  } catch (err) {
    console.error("Game save error:", err);
    res.status(500).send('Error saving game');
  }
});

// 2. Load Game
app.get('/api/game/load', async (req, res) => {
  const userId = req.query.userId as string;
  if (!userId) return res.status(400).send('Missing userId');

  try {
    if (!/^[a-zA-Z0-9_-]+$/.test(userId)) {
        return res.status(400).send('Invalid userId format');
    }

    const filePath = path.join(SAVES_DIR, `${userId}.json`);
    
    try {
        await fs.promises.access(filePath);
        const content = await fs.promises.readFile(filePath, 'utf8');
        res.json(JSON.parse(content));
    } catch {
        res.status(404).send('Save not found');
    }
  } catch (err) {
    console.error("Game load error:", err);
    res.status(500).send('Error loading game');
  }
});

app.get('/api/announcement', async (req, res) => {
  try {
    await fs.promises.access(ANNOUNCE_PATH);
    const content = await fs.promises.readFile(ANNOUNCE_PATH, 'utf8');
    res.json(JSON.parse(content));
  } catch (e) {
    // ถ้ายังไม่มีไฟล์ ให้ส่งค่าว่างกลับไป
    res.json({ text: '', timestamp: 0, sender: '' });
  }
});

// 2. บันทึกประกาศใหม่
app.post('/api/announcement', async (req, res) => {
  const { text, sender } = req.body;

  // 🔒 SECURITY CHECK: อนุญาตเฉพาะ TN680058 เท่านั้น
  if (sender !== 'TN680058') {
    return res.status(403).json({ success: false, message: "Unauthorized: Admin access only" });
  }

  try {
    const data = {
      text,
      sender: sender || 'Admin',
      timestamp: Date.now()
    };
    
    await fs.promises.writeFile(ANNOUNCE_PATH, JSON.stringify(data), 'utf8');
    res.json({ success: true });
  } catch (e) {
    console.error("Announce error:", e);
    res.status(500).send("Error saving announcement");
  }
});

// Endpoint สำหรับดึงข้อมูลเริ่มต้นทั้งหมดไป Cache ที่ Frontend
app.get('/api/sync/initial-state', async (req, res) => {
  const userId = req.query.userId as string;
  try {
    const readTsv = async (p: string) => {
        try {
            const content = await fs.promises.readFile(p, 'utf8');
            return content.split('\n').slice(1).filter(l => l.trim()).map(l => {
                    const [f, t] = l.split('\t'); return { filename: f, text: t };
                });
        } catch { return []; }
    };

    // ✅ เพิ่มการอ่าน trash.tsv (บรรทัดสุดท้ายใน array)
    const [correct, fail, userLog, changes, trash] = await Promise.all([
        readTsv(path.join(DATA_DIR, 'Correct.tsv')),
        readTsv(path.join(DATA_DIR, 'fail.tsv')),
        userId ? readTsv(path.join(DATA_DIR, `${userId}-Correct.tsv`)) : [],
        readTsv(path.join(DATA_DIR, 'ListOfChange.tsv')),
        readTsv(path.join(DATA_DIR, 'trash.tsv')) // <--- เพิ่มตรงนี้
    ]);

    // ✅ ส่ง trash กลับไปใน response
    res.json({ 
        correct, 
        fail, 
        userLog, 
        changes: changes.map((c: any) => ({ original: c.filename, changed: c.text })),
        trash // <--- เพิ่มตรงนี้
    });
  } catch { res.status(500).json({ error: "Failed to fetch" }); }
});

app.listen(PORT, () => {
  console.log(`Server running: http://10.2.98.118:3003:${PORT}`);
});