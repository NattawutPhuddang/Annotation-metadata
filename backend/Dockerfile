# audio-annotation/backend/Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy เฉพาะไฟล์ package เพื่อ install dependencies ก่อน (Cache layer)
COPY package*.json ./
RUN npm install

# Copy โค้ดทั้งหมด
COPY . .

# สร้างไฟล์ TSV เปล่าๆ ไว้ถ้ายังไม่มี (ป้องกัน Error)
RUN touch Correct.tsv fail.tsv ListOfChange.tsv

# Compile TypeScript
RUN npm run build

EXPOSE 3003

CMD ["node", "dist/server.js"]