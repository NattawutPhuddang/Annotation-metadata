# -*- coding: utf-8 -*-
import sys
import json
import io

# ตั้งค่า encoding เป็น utf-8 เพื่อรองรับภาษาไทย
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8')

# --- โซนโหลด Library (โหลดแค่ครั้งเดียวตอนเริ่ม) ---
try:
    from pythainlp import word_tokenize
except ImportError:
    # เผื่อกรณีไม่ได้ลงไว้ ให้ใช้ logic พื้นฐานแทน
    def word_tokenize(text, engine='newmm'):
        return text.split(' ')

def process_text(text):
    if not text:
        return []
    # ตัดคำภาษาไทย
    # keep_whitespace=False จะลบช่องว่างออก ถ้าต้องการเก็บไว้ให้แก้เป็น True
    return word_tokenize(text, engine='newmm', keep_whitespace=False)

# --- Main Loop (รอรับข้อมูลตลอดเวลา) ---
if __name__ == "__main__":
    # วนลูปอ่านข้อมูลทีละบรรทัดจาก Node.js
    for line in sys.stdin:
        try:
            # แปลงข้อมูลที่รับมา (JSON) เป็น Python Object
            data = json.loads(line)
            text = data.get('text', '')
            
            # ประมวลผล
            tokens = process_text(text)
            
            # ส่งผลลัพธ์กลับไป (Print JSON)
            print(json.dumps(tokens, ensure_ascii=False))
            
            # สำคัญ! ต้อง flush เพื่อส่งข้อมูลทันที ไม่ให้ค้างใน buffer
            sys.stdout.flush()
            
        except Exception as e:
            # กรณี error ให้ส่ง list ว่างกลับไป เพื่อไม่ให้ process ตาย
            sys.stderr.write(f"Error: {str(e)}\n")
            sys.stderr.flush()
            print(json.dumps([]))
            sys.stdout.flush()