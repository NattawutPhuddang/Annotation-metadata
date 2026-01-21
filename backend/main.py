import os
import time
import threading
from fastapi import FastAPI, HTTPException, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List

# PyThaiNLP Imports
from pythainlp import word_tokenize
from pythainlp.util import Trie
from pythainlp.corpus import thai_words

app = FastAPI()

# --- 1. Configuration ---
DATA_FOLDER = os.getenv("DATA_FOLDER", "./data")
os.makedirs(DATA_FOLDER, exist_ok=True)

# Path ของ Custom Dict (วางไว้คู่กับ main.py หรือ folder แม่)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DICT_PATH = os.path.join(BASE_DIR, 'custom_dict.txt')

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 2. Custom Dictionary Logic (Real-time) ---
custom_trie = None
last_mtime = 0

def load_custom_dict():
    """โหลดคำศัพท์สร้าง Trie ใหม่"""
    global last_mtime
    words = set(thai_words()) # เริ่มจากคำมาตรฐาน
    
    if os.path.exists(DICT_PATH):
        try:
            current_mtime = os.path.getmtime(DICT_PATH)
            last_mtime = current_mtime
            count = 0
            with open(DICT_PATH, 'r', encoding='utf-8') as f:
                for line in f:
                    word = line.strip()
                    if word:
                        words.add(word)
                        count += 1
            print(f"[Dictionary] Loaded {count} custom words.")
        except Exception as e:
            print(f"[Dictionary Error] {e}")
    
    return Trie(words)

# โหลดครั้งแรกตอน Start
custom_trie = load_custom_dict()

def watch_dict_file():
    """Thread คอยเฝ้าดูไฟล์ custom_dict.txt"""
    global custom_trie, last_mtime
    while True:
        time.sleep(2) # เช็คทุก 2 วินาที
        if os.path.exists(DICT_PATH):
            mtime = os.path.getmtime(DICT_PATH)
            if mtime != last_mtime:
                print("[Dictionary] File changed! Reloading...")
                custom_trie = load_custom_dict()

# รัน Thread แยก
threading.Thread(target=watch_dict_file, daemon=True).start()


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

# --- 4. Helper Functions ---
def get_file_path(filename):
    return os.path.join(DATA_FOLDER, filename)

# --- 5. API Endpoints ---

@app.get("/")
def read_root():
    return {"status": "Audio Annotation Backend is running"}

# 🟢 API: ตัดคำ (ใช้ custom_trie)
@app.post("/api/tokenize")
def tokenize(req: TokenizeRequest):
    if not req.text: return []
    try:
        # ใช้ custom_trie ที่โหลดมา
        return word_tokenize(req.text, engine="newmm", custom_dict=custom_trie, keep_whitespace=True)
    except:
        return []

# 🟢 API: ตัดคำ Batch (ใช้ custom_trie)
@app.post("/api/tokenize-batch")
def tokenize_batch(req: TokenizeBatchRequest):
    results = []
    try:
        for text in req.texts:
            if not text:
                results.append([])
            else:
                results.append(word_tokenize(text, engine="newmm", custom_dict=custom_trie, keep_whitespace=True))
        return results
    except Exception as e:
        print(f"Batch Error: {e}")
        return [[] for _ in req.texts]

# ... (API อื่นๆ เหมือนเดิม Copy มาวางต่อท้ายได้เลยครับ) ...
# API: อ่านไฟล์, บันทึกไฟล์, Scan Audio, ฯลฯ
# (ส่วนที่เหลือในไฟล์เดิมของคุณถูกต้องแล้ว ใช้ต่อได้เลย)

@app.get("/api/load-file")
def load_file(filename: str = Query(...)):
    path = get_file_path(filename)
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    return ""

@app.post("/api/save-file")
def save_file(req: SaveFileRequest):
    path = get_file_path(req.filename)
    with open(path, "w", encoding="utf-8") as f:
        f.write(req.content)
    return {"status": "saved"}

@app.post("/api/append-change")
def append_change(req: AppendChangeRequest):
    # อันนี้ของ Python อาจจะไม่ค่อยได้ใช้แล้ว เพราะเราย้ายไปทำที่ Node server.ts
    # แต่เก็บไว้ backup ได้ครับ
    path = get_file_path("ListOfChange.tsv")
    if not os.path.exists(path):
        with open(path, "w", encoding="utf-8") as f:
            f.write("original\tchanged\n")
    with open(path, "a", encoding="utf-8") as f:
        f.write(f"{req.original}\t{req.changed}\n")
    return {"status": "appended"}

@app.post("/api/scan-audio")
def scan_audio(req: ScanAudioRequest):
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
                full_path = os.path.join(root, file)
                results.append(full_path)
    return results

@app.get("/api/audio")
def get_audio(path: str = Query(...)):
    if os.path.exists(path):
        return FileResponse(path)
    return HTTPException(status_code=404, detail="File not found")

@app.post("/api/append-tsv")
def append_tsv(req: AppendTsvRequest):
    file_path = get_file_path(req.filename)
    rows = []
    if os.path.exists(file_path):
        with open(file_path, "r", encoding="utf-8") as f:
            lines = f.read().splitlines()
            if len(lines) > 0:
                if lines[0].strip() == "filename\ttext": lines = lines[1:]
                for line in lines:
                    if not line.strip(): continue
                    parts = line.split('\t')
                    if len(parts) >= 2:
                        rows.append({"filename": parts[0], "text": "\t".join(parts[1:])})
    found = False
    for row in rows:
        if row["filename"] == req.item.filename:
            row["text"] = req.item.text
            found = True
            break
    if not found:
        rows.append({"filename": req.item.filename, "text": req.item.text})
    header = "filename\ttext"
    content = [header]
    for row in rows:
        clean_text = row['text'].replace('\n', ' ').replace('\r', '')
        content.append(f"{row['filename']}\t{clean_text}")
    with open(file_path, "w", encoding="utf-8") as f:
        f.write("\n".join(content) + "\n")
    return {"status": "saved (upsert)"}

@app.get("/api/check-mtime")
def check_file_mtime(filename: str = Query(...)):
    file_path = get_file_path(filename)
    if os.path.exists(file_path):
        return {"mtime": os.path.getmtime(file_path)}
    return {"mtime": 0}

@app.post("/api/delete-tsv-entry")
def delete_tsv_entry(req: DeleteTsvEntryRequest):
    file_path = get_file_path(req.filename)
    if not os.path.exists(file_path): return {"status": "file not found"}
    with open(file_path, "r", encoding="utf-8") as f: lines = f.read().splitlines()
    if not lines: return {"status": "deleted"}
    header = lines[0]
    new_lines = [header]
    for line in lines[1:]:
        if not line.strip(): continue
        parts = line.split('\t')
        if parts[0] != req.key: new_lines.append(line)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write("\n".join(new_lines) + "\n")
    return {"status": "deleted"}

if __name__ == "__main__":
    import uvicorn
    # ⚠️ ตรวจสอบ Port ให้ตรงกับ Docker Compose (ถ้า Python รัน Port 5000 ก็แก้เป็น 5000)
    uvicorn.run(app, host="0.0.0.0", port=5000)