"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const os_1 = __importDefault(require("os")); // เพิ่ม import os
const app = (0, express_1.default)();
const PORT = 3003;
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// สแกนหาไฟล์เสียงทั้งหมดในโฟลเดอร์และโฟลเดอร์ย่อย
function scanAudioFiles(dirPath, audioFiles = []) {
    try {
        const files = fs_1.default.readdirSync(dirPath);
        files.forEach(file => {
            const filePath = path_1.default.join(dirPath, file);
            const stat = fs_1.default.statSync(filePath);
            if (stat.isDirectory()) {
                // ถ้าเป็นโฟลเดอร์ ให้ค้นหาต่อ
                scanAudioFiles(filePath, audioFiles);
            }
            else if (stat.isFile() && file.endsWith('.wav')) {
                // ถ้าเป็นไฟล์ .wav ให้เพิ่มเข้า list
                audioFiles.push(filePath);
            }
        });
        return audioFiles;
    }
    catch (error) {
        console.error('Error scanning directory:', error);
        throw error;
    }
}
app.post('/api/list-files', (req, res) => {
    // ถ้าไม่ส่ง path มา ให้เริ่มที่ Home Directory ของเครื่อง
    let { currentPath } = req.body;
    if (!currentPath) {
        currentPath = os_1.default.homedir();
    }
    try {
        const resolvedPath = path_1.default.resolve(currentPath);
        const items = fs_1.default.readdirSync(resolvedPath, { withFileTypes: true });
        const folders = [];
        const files = [];
        items.forEach(item => {
            if (item.isDirectory()) {
                folders.push(item.name);
            }
            else {
                // โชว์เฉพาะไฟล์เสียง หรือไฟล์ที่เกี่ยวข้องเพื่อให้ user มั่นใจ
                if (/\.(wav|mp3|m4a|flac|aac|ogg)$/i.test(item.name)) {
                    files.push(item.name);
                }
            }
        });
        res.json({
            path: resolvedPath,
            parent: path_1.default.dirname(resolvedPath),
            folders,
            files
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Cannot read directory', path: currentPath });
    }
});
// API: สแกนไฟล์เสียง
app.post('/api/scan-audio', (req, res) => {
    const { path: audioPath } = req.body;
    if (!audioPath) {
        return res.status(400).json({ error: 'Path is required' });
    }
    try {
        // ตรวจสอบว่า path มีอยู่จริง
        if (!fs_1.default.existsSync(audioPath)) {
            return res.status(404).json({ error: 'Path not found' });
        }
        const audioFiles = scanAudioFiles(audioPath);
        res.json(audioFiles);
    }
    catch (error) {
        console.error('Error in scan-audio:', error);
        res.status(500).json({ error: 'Failed to scan audio files' });
    }
});
// API: Serve ไฟล์เสียง
app.get('/api/audio/:encodedPath', (req, res) => {
    try {
        // 2. ดึงค่าตัวแปรและระบุ Type เป็น string
        const encodedPath = req.params.encodedPath;
        // หมายเหตุ: Express จะ Decode URL ให้ชั้นนึงแล้ว แต่การใส่ decodeURIComponent ซ้ำ
        // มักไม่มีผลเสียกับ File Path ทั่วไป (เว้นแต่ชื่อไฟล์จะมี % อยู่)
        const audioPath = decodeURIComponent(encodedPath);
        // ... (โค้ดส่วนตรวจสอบไฟล์และ stream ไฟล์ ให้ใช้เหมือนเดิม)
        if (!fs_1.default.existsSync(audioPath)) {
            return res.status(404).json({ error: 'Audio file not found' });
        }
        // Stream ไฟล์เสียง
        const stat = fs_1.default.statSync(audioPath);
        const fileSize = stat.size;
        const range = req.headers.range;
        if (range) {
            // รองรับ range request สำหรับการเล่นเสียง
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;
            const file = fs_1.default.createReadStream(audioPath, { start, end });
            const head = {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': 'audio/wav',
            };
            res.writeHead(206, head);
            file.pipe(res);
        }
        else {
            // ส่งไฟล์ทั้งหมด
            const head = {
                'Content-Length': fileSize,
                'Content-Type': 'audio/wav',
            };
            res.writeHead(200, head);
            fs_1.default.createReadStream(audioPath).pipe(res);
        }
    }
    catch (error) {
        console.error('Error serving audio:', error);
        res.status(500).json({ error: 'Failed to serve audio file' });
    }
});
// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Audio Annotation Backend is running' });
});
// API: บันทึกไฟล์ TSV ลงเครื่อง (Real-time Save)
app.post('/api/save-file', (req, res) => {
    const { filename, content } = req.body;
    if (!filename || typeof content !== 'string') {
        return res.status(400).json({ error: 'Invalid data' });
    }
    try {
        // บันทึกไฟล์ไว้ที่โฟลเดอร์ root ของ backend (ข้างๆ package.json)
        // หรือถ้าอยากให้ไปอยู่ที่อื่นก็แก้ path ตรงนี้ได้ครับ
        const filePath = path_1.default.join(__dirname, '..', filename);
        fs_1.default.writeFileSync(filePath, content, 'utf-8');
        console.log(`💾 Auto-saved: ${filename}`);
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error saving file:', error);
        res.status(500).json({ error: 'Failed to save file' });
    }
});
app.listen(PORT, () => {
    console.log(`🚀 Backend server running on http://localhost:${PORT}`);
    console.log(`📁 Ready to scan audio files and serve them`);
});
// API: ตัดคำด้วย PyThaiNLP (เรียก Python Script)
app.post('/api/tokenize', (req, res) => {
    const { text } = req.body;
    if (!text)
        return res.status(400).json({ error: 'Text required' });
    // Escape double quotes เพื่อป้องกัน command line error
    const safeText = text.replace(/"/g, '\\"');
    // Path ไปยังไฟล์ python (ใช้ venv python เพื่อให้เข้าถึง pythainlp)
    const scriptPath = path_1.default.join(__dirname, '..', 'src', 'tokenizer.py');
    const pythonPath = path_1.default.join(__dirname, '..', '..', '.venv', 'Scripts', 'python.exe');
    const command = `"${pythonPath}" "${scriptPath}" "${safeText}"`;
    (0, child_process_1.exec)(command, (error, stdout, stderr) => {
        if (error) {
            console.error('Exec error:', error);
            return res.status(500).json({ error: 'Failed to execute tokenizer' });
        }
        try {
            const tokens = JSON.parse(stdout.trim());
            if (tokens.error) {
                return res.status(500).json({ error: tokens.error });
            }
            res.json(tokens);
        }
        catch (e) {
            console.error('Parse error:', stdout);
            res.status(500).json({ error: 'Invalid response from tokenizer' });
        }
    });
});
