# ใช้ Python 3.9 แบบเบาๆ
FROM python:3.9-slim

WORKDIR /app

# ติดตั้ง dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ก๊อปปี้โค้ดทั้งหมด
COPY . .

# สร้างโฟลเดอร์ data รอไว้
RUN mkdir -p data

# เปิด Port 3003
EXPOSE 3003

# คำสั่งรัน Server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3003"]