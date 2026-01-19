import os
from fastapi import FastAPI, HTTPException, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from pythainlp import word_tokenize
from typing import List

app = FastAPI()

# Config
DATA_FOLDER = os.getenv("DATA_FOLDER", "./data")
os.makedirs(DATA_FOLDER, exist_ok=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Data Models ---
class TokenizeRequest(BaseModel):
    text: str

class TokenizeBatchRequest(BaseModel):
    texts: List[str]  # 🟢 รับเป็น List ข้อความ

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

def get_file_path(filename):
    return os.path.join(DATA_FOLDER, filename)

# --- API Endpoints ---

@app.post("/api/tokenize")
def tokenize(req: TokenizeRequest):
    if not req.text: return []
    try:
        return word_tokenize(req.text, engine="newmm", keep_whitespace=True)
    except:
        return []

# 🟢 API ใหม่: ตัดคำทีเดียวหลายประโยค (Batch)
@app.post("/api/tokenize-batch")
def tokenize_batch(req: TokenizeBatchRequest):
    results = []
    try:
        for text in req.texts:
            if not text:
                results.append([])
            else:
                # ใช้ newmm ตามเดิม
                results.append(word_tokenize(text, engine="newmm", keep_whitespace=True))
        return results # ส่งกลับเป็น List ของ List Token [[...], [...]]
    except Exception as e:
        print(f"Batch Error: {e}")
        return [[] for _ in req.texts]

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
    path = get_file_path("ListOfChange.tsv")
    if not os.path.exists(path):
        with open(path, "w", encoding="utf-8") as f:
            f.write("original\tchanged\n")
    with open(path, "a", encoding="utf-8") as f:
        f.write(f"{req.original}\t{req.changed}\n")
    return {"status": "appended"}

@app.post("/api/scan-audio")
def scan_audio(req: ScanAudioRequest):
    # ปรับปรุง Logic สแกนให้ค้นหาแบบ Recursive จริงๆ
    if not os.path.exists(req.path):
        # ลองดูใน data folder (กรณีรัน Docker)
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

    # 1. อ่านข้อมูลเก่าขึ้นมา (ถ้ามีไฟล์)
    if os.path.exists(file_path):
        with open(file_path, "r", encoding="utf-8") as f:
            lines = f.read().splitlines()
            if len(lines) > 1: # ข้าม Header
                for line in lines[1:]:
                    if not line.strip(): continue
                    parts = line.split('\t')
                    if len(parts) >= 2:
                        # แยก filename กับ text
                        rows.append({"filename": parts[0], "text": "\t".join(parts[1:])})

    # 2. เช็คว่ามี filename นี้อยู่แล้วหรือยัง? (Upsert Logic)
    found = False
    for row in rows:
        if row["filename"] == req.item.filename:
            row["text"] = req.item.text # อัปเดตข้อความใหม่
            found = True
            break
    
    if not found:
        rows.append({"filename": req.item.filename, "text": req.item.text})

    # 3. เขียนไฟล์ใหม่
    header = "filename\ttext"
    content = [header]
    for row in rows:
        content.append(f"{row['filename']}\t{row['text']}")
    
    with open(file_path, "w", encoding="utf-8") as f:
        f.write("\n".join(content))
        
    return {"status": "saved (upsert)"}

# 3. เพิ่ม API Endpoint: delete-tsv-entry (สำหรับลบรายการเมื่อกดย้ายไป Fail)
@app.post("/api/delete-tsv-entry")
def delete_tsv_entry(req: DeleteTsvEntryRequest):
    file_path = get_file_path(req.filename)
    
    if not os.path.exists(file_path):
        return {"status": "file not found"}
        
    with open(file_path, "r", encoding="utf-8") as f:
        lines = f.read().splitlines()
        
    if not lines: return {"status": "deleted"}
    
    # เก็บ Header ไว้
    header = lines[0]
    new_lines = [header]
    
    # กรองแถวที่ key (ชื่อไฟล์เสียง) ตรงกันทิ้งไป
    for line in lines[1:]:
        if not line.strip(): continue
        parts = line.split('\t')
        # parts[0] คือชื่อไฟล์เสียงใน TSV
        if parts[0] != req.key:
            new_lines.append(line)
            
    # เขียนไฟล์ทับ
    with open(file_path, "w", encoding="utf-8") as f:
        f.write("\n".join(new_lines))

    return {"status": "deleted"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3003)