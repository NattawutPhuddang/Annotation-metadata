import os
import time
import threading
from typing import List

from fastapi import FastAPI, HTTPException, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

# PyThaiNLP Imports
from pythainlp import word_tokenize
from pythainlp.util import Trie
from pythainlp.corpus import thai_words

app = FastAPI()

# --- 1. Configuration ---
# ใช้ Folder "data" เป็นศูนย์กลางข้อมูล
DATA_FOLDER = os.getenv("DATA_FOLDER", "./data")
os.makedirs(DATA_FOLDER, exist_ok=True)

# Path ของ Custom Dictionary (ย้ายมาไว้ใน data เพื่อให้แชร์กับ Node.js ได้ง่าย)
DICT_PATH = os.path.join(DATA_FOLDER, 'custom_dict.txt')

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 2. Custom Dictionary Logic (Real-time Watcher) ---
custom_trie = None
last_mtime = 0

def load_custom_dict():
    """โหลดคำศัพท์สร้าง Trie ใหม่"""
    global last_mtime
    words = set(thai_words()) # 1. เริ่มจากคำมาตรฐานภาษาไทย
    
    if os.path.exists(DICT_PATH):
        try:
            # จำเวลาแก้ไขไฟล์ล่าสุดไว้
            current_mtime = os.path.getmtime(DICT_PATH)
            last_mtime = current_mtime
            
            count = 0
            with open(DICT_PATH, 'r', encoding='utf-8') as f:
                for line in f:
                    word = line.strip()
                    if word:
                        words.add(word) # 2. เพิ่มคำศัพท์ใหม่ลงไป
                        count += 1
            print(f"[Dictionary] Loaded {count} custom words from {DICT_PATH}")
        except Exception as e:
            print(f"[Dictionary Error] Failed to read custom_dict: {e}")
    else:
        print(f"[Dictionary] {DICT_PATH} not found, using standard corpus only.")
    
    # 3. สร้าง Trie สำหรับตัดคำ
    return Trie(words)

# โหลดครั้งแรกตอน Start Server
custom_trie = load_custom_dict()

def watch_dict_file():
    """Background Thread: คอยเช็คว่าไฟล์ custom_dict.txt เปลี่ยนหรือไม่"""
    global custom_trie, last_mtime
    while True:
        time.sleep(2) # เช็คทุกๆ 2 วินาที
        if os.path.exists(DICT_PATH):
            mtime = os.path.getmtime(DICT_PATH)
            # ถ้าเวลาแก้ไขไฟล์ไม่ตรงกับของเดิม แปลว่าไฟล์เปลี่ยน -> โหลดใหม่
            if mtime != last_mtime:
                print("[Dictionary] File changed! Reloading...")
                custom_trie = load_custom_dict()

# รัน Thread แยกเพื่อเฝ้าดูไฟล์
watcher_thread = threading.Thread(target=watch_dict_file, daemon=True)
watcher_thread.start()


# --- 3. Data Models ---
class TokenizeRequest(BaseModel):
    text: str

class TokenizeBatchRequest(BaseModel):
    texts: List[str]

class SaveFileRequest(BaseModel):
    filename: str
    content: str

class AppendChangeRequest(BaseModel):
    original: str
    changed: str

class ScanAudioRequest(BaseModel):
    path: str

class AudioItem(BaseModel):
    filename: str
    text: str

class AppendTsvRequest(BaseModel):
    filename: str
    item: AudioItem

class DeleteTsvEntryRequest(BaseModel):
    filename: str
    key: str

class MoveToTrashRequest(BaseModel):
    filename: str
    sourceFile: str = "Correct.tsv"  # default value

# --- 4. Helper Functions ---
def get_file_path(filename):
    # ป้องกัน Directory Traversal
    safe_filename = os.path.basename(filename)
    if filename == 'ListOfChange.tsv' or filename == 'custom_dict.txt': 
         # อนุญาตไฟล์เฉพาะบางไฟล์ที่อาจระบุชื่อตรงๆ
         pass
    return os.path.join(DATA_FOLDER, filename)

# --- 5. API Endpoints ---

@app.get("/")
def read_root():
    return {"status": "Audio Annotation Backend (Python) is running"}

# 🟢 API: ตัดคำ (Single) - ใช้ custom_trie
@app.post("/api/tokenize")
def tokenize(req: TokenizeRequest):
    if not req.text: return []
    try:
        return word_tokenize(req.text, engine="newmm", custom_dict=custom_trie, keep_whitespace=True)
    except Exception as e:
        print(f"Tokenize Error: {e}")
        return []

# 🟢 API: ตัดคำ (Batch) - ใช้ custom_trie
@app.post("/api/tokenize-batch")
def tokenize_batch(req: TokenizeBatchRequest):
    results = []
    try:
        for text in req.texts:
            if not text:
                results.append([])
            else:
                tokens = word_tokenize(text, engine="newmm", custom_dict=custom_trie, keep_whitespace=True)
                results.append(tokens)
        return results
    except Exception as e:
        print(f"Batch Error: {e}")
        # Return list ว่างเท่าจำนวน input เพื่อกัน Frontend พัง
        return [[] for _ in req.texts]

# API: อ่านไฟล์ Text/TSV
@app.get("/api/load-file")
def load_file(filename: str = Query(...)):
    path = get_file_path(filename)
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    return ""

# API: บันทึกไฟล์ทับทั้งไฟล์
@app.post("/api/save-file")
def save_file(req: SaveFileRequest):
    path = get_file_path(req.filename)
    with open(path, "w", encoding="utf-8") as f:
        f.write(req.content)
    return {"status": "saved"}

# API: บันทึกประวัติการแก้คำผิด (Backup ไว้ เผื่อ Node.js เรียกใช้)
@app.post("/api/append-change")
def append_change(req: AppendChangeRequest):
    path = get_file_path("ListOfChange.tsv")
    if not os.path.exists(path):
        with open(path, "w", encoding="utf-8") as f:
            f.write("original\tchanged\n")
    with open(path, "a", encoding="utf-8") as f:
        f.write(f"{req.original}\t{req.changed}\n")
    return {"status": "appended"}

# API: สแกนไฟล์เสียง
@app.post("/api/scan-audio")
def scan_audio(req: ScanAudioRequest):
    # เช็ค Path ภายใน Docker ก่อน
    if not os.path.exists(req.path):
        internal_path = os.path.join(DATA_FOLDER, req.path)
        scan_path = internal_path if os.path.exists(internal_path) else req.path
    else:
        scan_path = req.path

    if not os.path.exists(scan_path):
        return []

    results = []
    for root, dirs, files in os.walk(scan_path):
        for file in files:
            if file.lower().endswith(('.wav', '.mp3', '.m4a', '.flac')):
                # ส่ง Path กลับไป (อาจต้องปรับ Path ให้ Client เข้าถึงได้ถ้าอยู่คนละเครื่อง)
                full_path = os.path.join(root, file)
                results.append(full_path)
    return results

# API: Stream ไฟล์เสียง
@app.get("/api/audio")
def get_audio(path: str = Query(...)):
    if os.path.exists(path):
        return FileResponse(path)
    return HTTPException(status_code=404, detail="File not found")

# API: บันทึก/อัปเดตบรรทัดเดียว (Upsert Logic)
@app.post("/api/append-tsv")
def append_tsv(req: AppendTsvRequest):
    file_path = get_file_path(req.filename)
    rows = []

    # 1. อ่านข้อมูลเก่า
    if os.path.exists(file_path):
        with open(file_path, "r", encoding="utf-8") as f:
            lines = f.read().splitlines()
            if len(lines) > 0:
                if lines[0].strip() == "filename\ttext":
                    lines = lines[1:]
                
                for line in lines:
                    if not line.strip(): continue
                    parts = line.split('\t')
                    if len(parts) >= 2:
                        rows.append({"filename": parts[0], "text": "\t".join(parts[1:])})

    # 2. Upsert (ทับข้อมูลเดิมถ้ามี key ซ้ำ)
    found = False
    for row in rows:
        if row["filename"] == req.item.filename:
            row["text"] = req.item.text
            found = True
            break
    
    if not found:
        rows.append({"filename": req.item.filename, "text": req.item.text})

    # 3. เขียนไฟล์ใหม่
    header = "filename\ttext"
    content = [header]
    for row in rows:
        clean_text = row['text'].replace('\n', ' ').replace('\r', '')
        content.append(f"{row['filename']}\t{clean_text}")
    
    with open(file_path, "w", encoding="utf-8") as f:
        f.write("\n".join(content) + "\n")
        
    return {"status": "saved (upsert)"}

# API: เช็คเวลาแก้ไขไฟล์ (Smart Polling)
@app.get("/api/check-mtime")
def check_file_mtime(filename: str = Query(...)):
    file_path = get_file_path(filename)
    if os.path.exists(file_path):
        return {"mtime": os.path.getmtime(file_path)}
    return {"mtime": 0}

# API: ลบรายการ (Delete Logic)
@app.post("/api/delete-tsv-entry")
def delete_tsv_entry(req: DeleteTsvEntryRequest):
    file_path = get_file_path(req.filename)
    
    if not os.path.exists(file_path):
        return {"status": "file not found"}
        
    with open(file_path, "r", encoding="utf-8") as f:
        lines = f.read().splitlines()
        
    if not lines: return {"status": "deleted"}
    
    header = lines[0]
    new_lines = [header]
    
    # กรองเอาเฉพาะบรรทัดที่ไม่ใช่ key ที่ส่งมา
    for line in lines[1:]:
        if not line.strip(): continue
        parts = line.split('\t')
        if parts[0] != req.key:
            new_lines.append(line)
            
    with open(file_path, "w", encoding="utf-8") as f:
        f.write("\n".join(new_lines) + "\n")

    return {"status": "deleted"}

# 🟢 API: ย้ายไฟล์ลงถังขยะ (Move to Trash)
@app.post("/api/move-to-trash")
def move_to_trash(req: MoveToTrashRequest):
    source_path = get_file_path(req.sourceFile)
    trash_path = get_file_path('trash.tsv')
    
    item_to_trash = None
    
    # 1. ค้นหาและลบออกจากไฟล์ต้นฉบับ
    if os.path.exists(source_path):
        with open(source_path, "r", encoding="utf-8") as f:
            lines = f.read().splitlines()
            
        if lines:
            header = lines[0]
            new_lines = [header]
            # กรองเอาเฉพาะบรรทัดที่ไม่ใช่ไฟล์ที่ต้องการลบ
            for line in lines[1:]:
                if not line.strip(): continue
                parts = line.split('\t')
                if parts[0] == req.filename:
                    item_to_trash = line # เก็บข้อมูลไว้ก่อนลบ
                else:
                    new_lines.append(line)
            
            # บันทึกไฟล์ต้นฉบับใหม่ (ถ้าเจอตัวลบ)
            if item_to_trash:
                with open(source_path, "w", encoding="utf-8") as f:
                    f.write("\n".join(new_lines) + "\n")
    
    if not item_to_trash:
        # ถ้าหาไม่เจอ หรือไฟล์ต้นฉบับไม่มี
        return {"status": "item not found or source file missing"}

    # 2. เพิ่มลงใน trash.tsv
    need_header = not os.path.exists(trash_path)
    with open(trash_path, "a", encoding="utf-8") as f:
        if need_header:
            f.write("filename\ttext\n")
        f.write(item_to_trash + "\n")
        
    return {"status": "moved to trash"}

if __name__ == "__main__":
    import uvicorn
    # รันบน Port 5000 (ตรวจดู docker-compose ให้ map 5000:5000 ด้วย)
    uvicorn.run(app, host="0.0.0.0", port=5001)