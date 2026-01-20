import os
from fastapi import FastAPI, HTTPException, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from pythainlp import word_tokenize
from typing import List

app = FastAPI()

# --- 1. Configuration ---
DATA_FOLDER = os.getenv("DATA_FOLDER", "./data")
os.makedirs(DATA_FOLDER, exist_ok=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 2. Data Models ---
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

# --- 3. Helper Functions ---
def get_file_path(filename):
    return os.path.join(DATA_FOLDER, filename)

# --- 4. API Endpoints ---

@app.get("/")
def read_root():
    return {"status": "Audio Annotation Backend is running"}

# API: ตัดคำ (Single)
@app.post("/api/tokenize")
def tokenize(req: TokenizeRequest):
    if not req.text: return []
    try:
        return word_tokenize(req.text, engine="newmm", keep_whitespace=True)
    except:
        return []

# API: ตัดคำทีละเยอะๆ (Batch)
@app.post("/api/tokenize-batch")
def tokenize_batch(req: TokenizeBatchRequest):
    results = []
    try:
        for text in req.texts:
            if not text:
                results.append([])
            else:
                results.append(word_tokenize(text, engine="newmm", keep_whitespace=True))
        return results
    except Exception as e:
        print(f"Batch Error: {e}")
        return [[] for _ in req.texts]

# API: อ่านไฟล์ Text/TSV
@app.get("/api/load-file")
def load_file(filename: str = Query(...)):
    path = get_file_path(filename)
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    return ""

# API: บันทึกไฟล์ทับทั้งไฟล์ (Legacy / Bulk Save)
@app.post("/api/save-file")
def save_file(req: SaveFileRequest):
    path = get_file_path(req.filename)
    with open(path, "w", encoding="utf-8") as f:
        f.write(req.content)
    return {"status": "saved"}

# API: บันทึกประวัติการแก้คำผิด (ListOfChange)
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
    if not os.path.exists(req.path):
        # ลองดูใน data folder เผื่อเป็น path ภายใน Docker
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

# API: Stream ไฟล์เสียง
@app.get("/api/audio")
def get_audio(path: str = Query(...)):
    if os.path.exists(path):
        return FileResponse(path)
    return HTTPException(status_code=404, detail="File not found")

# API: บันทึก/อัปเดตบรรทัดเดียว (Upsert Logic)
# ใช้สำหรับ Correct.tsv และ fail.tsv เพื่อไม่ให้ข้อมูลซ้ำ
@app.post("/api/append-tsv")
def append_tsv(req: AppendTsvRequest):
    file_path = get_file_path(req.filename)
    rows = []

    # 1. อ่านข้อมูลเก่าขึ้นมา (ถ้ามีไฟล์)
    if os.path.exists(file_path):
        with open(file_path, "r", encoding="utf-8") as f:
            lines = f.read().splitlines()
            if len(lines) > 0:
                # เช็ค Header
                if lines[0].strip() == "filename\ttext":
                    lines = lines[1:] # ข้าม Header เดิม
                
                for line in lines:
                    if not line.strip(): continue
                    parts = line.split('\t')
                    if len(parts) >= 2:
                        # filename อยู่ช่องแรก, text อยู่ช่องหลัง (รวม tab ใน text ถ้ามี)
                        rows.append({"filename": parts[0], "text": "\t".join(parts[1:])})

    # 2. เช็คว่ามี filename นี้อยู่แล้วหรือยัง? (Upsert)
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
        # ล้าง \n ออกจาก text เพื่อไม่ให้ไฟล์พัง
        clean_text = row['text'].replace('\n', ' ').replace('\r', '')
        content.append(f"{row['filename']}\t{clean_text}")
    
    with open(file_path, "w", encoding="utf-8") as f:
        f.write("\n".join(content) + "\n")
        
    return {"status": "saved (upsert)"}
@app.get("/api/check-mtime")
def check_file_mtime(filename: str = Query(...)):
    """เช็คเวลาแก้ไขล่าสุดของไฟล์ (Lightweight Check)"""
    file_path = get_file_path(filename)
    if os.path.exists(file_path):
        # คืนค่าเวลาเป็น Timestamp (float)
        return {"mtime": os.path.getmtime(file_path)}
    return {"mtime": 0}
# API: ลบบรรทัดเดียว (Delete Logic)
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
        if parts[0] != req.key:
            new_lines.append(line)
            
    # เขียนไฟล์ทับ
    with open(file_path, "w", encoding="utf-8") as f:
        f.write("\n".join(new_lines) + "\n")

    return {"status": "deleted"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3003)