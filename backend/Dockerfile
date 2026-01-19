# ใช้ Node.js 18 แบบเบาๆ
FROM node:18-alpine

WORKDIR /app

# ติดตั้ง dependencies
COPY package*.json ./
RUN npm install

# ก๊อปปี้โค้ดทั้งหมด
COPY . .

# สร้างโฟลเดอร์ data รอไว้
RUN mkdir -p data

# Build TypeScript
RUN npm run build

# เปิด Port 3003
EXPOSE 3003

# คำสั่งรัน Server
CMD ["npm", "start"]