# 🎙️ Thai ASR Annotation & Correction System

ระบบสำหรับแก้ไขและตรวจสอบความถูกต้องของข้อมูลเสียง (ASR Data Correction) ใช้งานภายในองค์กร รองรับการทำงานแบบ Offline ด้วย PyThaiNLP (ผ่าน Pyodide) และ Sync ข้อมูลสถิติไปยัง Lark (Feishu)

## 🏗️ Architecture Overview

ระบบประกอบด้วย 3 ส่วนหลัก:

1. **Frontend (React + TypeScript):**
* หน้าจอสำหรับฟังเสียง ดู Waveform และแก้ไขข้อความ
* **Offline Capability:** ใช้ `Pyodide` รัน Python ใน Browser เพื่อตัดคำ (Tokenize) โดยไม่ต้องต่อเน็ต
* **State Management:** ใช้ Context API + `localforage` (IndexedDB) เพื่อบันทึกข้อมูลชั่วคราวกันข้อมูลหาย


2. **Backend (Node.js + Express):**
* API สำหรับจัดการไฟล์ (Load/Save/Append TSV)
* ระบบ **File Locking** ป้องกันการเขียนไฟล์ทับกัน
* **Auto Backup:** สำรองข้อมูลอัตโนมัติทุกนาที
* **Lark Sync:** ส่งสถิติ (Correct/Fail count) ไปยัง Lark Base


3. **Data Storage (Local Files):**
* เก็บข้อมูลเป็นไฟล์ `.tsv` (Tab Separated Values)
* โฟลเดอร์ `backend/data` คือหัวใจสำคัญของข้อมูล



---

## 🚀 Prerequisites

ก่อนเริ่มรันโปรเจกต์ ต้องติดตั้ง:

* [Node.js](https://nodejs.org/) (แนะนำ v18 หรือ v20 LTS)
* [Python 3.11+](https://www.python.org/) (สำหรับจัดการ Script เสริม หรือรัน Python Service ถ้าจำเป็น)
* **Internet:** จำเป็นเฉพาะตอน `npm install` และโหลด Pyodide ครั้งแรก (หลังจากนั้นทำงาน Offline ได้ถ้า Cache ครบ)

---

## 🛠️ Installation & Setup

### 1. Backend Setup (Node.js API)

ทำหน้าที่อ่านเขียนไฟล์และเชื่อมต่อ Lark

```bash
cd backend
npm install

# สร้างโฟลเดอร์ data ถ้ายังไม่มี
mkdir data 

# รัน Server (Development Mode)
npm run dev

```

* Server จะรันที่: `http://localhost:3003`

### 2. Frontend Setup (React App)

หน้าเว็บหลักสำหรับ User

```bash
cd frontend
npm install

# ต้องแน่ใจว่าไฟล์ Python Wheel (.whl) อยู่ใน public/wheels ครบถ้วน (ดูหัวข้อ Pyodide)

# รัน Frontend
npm start

```

* Web App จะรันที่: `http://localhost:3000`

---

## ⚙️ Configuration (.env)

สร้างไฟล์ `.env` ในแต่ละโฟลเดอร์ตามตัวอย่าง:

**backend/.env**

```env
PORT=3003
# Config สำหรับ Lark (Feishu) Integration
Lark_App_ID=cli_xxxxxxxxxxxx
Lark_App_Secret=xxxxxxxxxxxxxxxxxxxx
Lark_Base_Token=xxxxxxxxxxxx
Lark_Table_ID=xxxxxxxxxxxx

```

**frontend/.env** (ถ้ามี)

```env
REACT_APP_API_URL=http://localhost:3003

```

---

## 🧠 Key Features & Technical Details

### 1. Pyodide & Offline NLP (สำคัญมาก ⚠️)

Frontend ใช้ **Pyodide** เพื่อรัน `PyThaiNLP` บน Browser โดยตรง (ไฟล์ `frontend/src/utils/pyThaiNLPService.ts`)

* **Wheels:** ระบบต้องการไฟล์ `.whl` เพื่อติดตั้ง Library แบบ Offline
* **Location:** ไฟล์ต้องวางอยู่ที่ `frontend/public/wheels/`
* **Naming:** ชื่อไฟล์ในโค้ด `pyThaiNLPService.ts` ต้องตรงกับไฟล์จริง 100%
* `tzdata-xxxx.x-py2.py3-none-any.whl`
* `pythainlp-x.x.x-py3-none-any.whl`


* *ถ้ามีการอัปเดตเวอร์ชัน Library ต้องโหลดไฟล์ใหม่มาวาง และแก้ชื่อในโค้ดเสมอ*

### 2. Lark (Feishu) Sync

Backend จะทำการ Sync ข้อมูลสถิติ (Correct/Fail) ของแต่ละ User ไปยัง Lark Base ทุกๆ 30 วินาที

* Logic อยู่ใน `backend/src/server.ts` (ฟังก์ชัน `syncStatsToLark`)
* ใช้ `axios` + `httpsAgent` เพื่อจัดการ Connection (Keep-Alive)

### 3. File System Structure (`backend/data`)

* `Correct.tsv`: รายการไฟล์ที่ตรวจเสร็จแล้ว (ถูกต้อง)
* `fail.tsv`: รายการไฟล์ที่แจ้งว่าผิด (Incorrect)
* `ListOfChange.tsv`: ประวัติการแก้ไขข้อความ
* `trash.tsv`: ไฟล์ที่ถูกลบ (Recycle Bin)
* `[EmployeeID]-Correct.tsv`: Log การทำงานรายบุคคล
* `backups/`: โฟลเดอร์สำรองข้อมูลอัตโนมัติ (เก็บย้อนหลัง 10 เวอร์ชัน)

---

## 🐛 Common Issues & Troubleshooting

| อาการ | สาเหตุที่เป็นไปได้ | วิธีแก้ไข |
| --- | --- | --- |
| **Pyodide Error: BadZipFile** | หาไฟล์ .whl ไม่เจอ หรือชื่อไฟล์ในโค้ดไม่ตรงกับในโฟลเดอร์ | เช็ค `frontend/public/wheels` และแก้ชื่อไฟล์ใน `pyThaiNLPService.ts` ให้ตรงกัน |
| **Server Error: socket hang up** | Lark API ตัด Connection | ระบบแก้ไว้แล้วด้วย `httpsAgent` (Keep-Alive) ใน `server.ts` แต่ถ้ายังเป็นให้เช็ค Internet |
| **ไฟล์ที่ลบไปแล้วเด้งกลับมา** | Frontend ไม่ได้รับข้อมูล Trash | เช็ค `backend/src/server.ts` API `/initial-state` ว่าส่ง `trash` กลับมาหรือไม่ |
| **Tokenize ช้า / ค้าง** | โหลด Python engine ไม่เสร็จ | รอให้ขึ้น Log "PyThaiNLP is ready" ใน Console ก่อนเริ่มใช้งาน |

---

## 📂 Project Structure

```
root/
├── backend/
│   ├── src/
│   │   ├── server.ts         # Main Backend Logic (API, Lark Sync)
│   │   └── ...
│   ├── data/                 # ที่เก็บไฟล์ TSV (ถูกสร้าง Auto)
│   └── Dockerfile            # สำหรับ Deploy
│
├── frontend/
│   ├── public/
│   │   ├── pyodide/          # Core files ของ Pyodide
│   │   └── wheels/           # Python Libraries (.whl) สำหรับ Offline Mode
│   ├── src/
│   │   ├── api/              # เชื่อมต่อ Backend
│   │   ├── context/          # Global State (AnnotationContext)
│   │   ├── utils/
│   │   │   └── pyThaiNLPService.ts  # Logic Pyodide & Tokenizer
│   │   └── ...
│   └── ...
└── README.md

```

---

### 📝 Note for Maintainer

* **Backup Data:** ควร Backup โฟลเดอร์ `backend/data` ไปเก็บที่อื่นเป็นระยะ
* **Update Pyodide:** หาก Pyodide ออกเวอร์ชันใหม่ ต้องอัปเดตทั้งไฟล์ใน `public/pyodide` และโค้ด init ใน Service
* **Concurrent Users:** ระบบใช้ File Locking แบบง่าย (Mutex) รองรับผู้ใช้ได้ระดับหนึ่ง แต่ถ้าคนใช้เยอะมากพร้อมกัน อาจต้องเปลี่ยนไปใช้ Database จริง (SQLite/Postgres)



### ปัญหา
เมื่อมีการทำ OfflineMode บางครั้งจะทำให้ไฟล Correct เป็น Null วิธีการกู้คืนคือ ในแต่ละ User จะเก็บ Correct อยู่แล้ว เราจะทำการดึงตัวที่ไม่ซ้ำจากแต่ละ user เข้ามาแทน โดยใช้คำสั่งดังนี้
awk '!seen[$0]++' Correct.tsv *-Correct.tsv > temp.tsv && mv temp.tsv Correct.tsv