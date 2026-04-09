# ObjectEye Monorepo

A complete video processing system with real-time AI object detection.

## Structure
- `/client`: React + TypeScript + Tailwind frontend.
- `/server`: Node.js + Express + Socket.IO + Mongoose backend.
- `/ml-server`: Flask + YOLOv8 object detection server.

## Prerequisites
1. **Python 3.8+**
2. **Node.js 16+**
3. **MongoDB** (running locally or a URI)
4. **FFmpeg** (installed and in PATH)

## Setup & Running

### 1. ML Server
```bash
cd ml-server
pip install flask flask-cors ultralytics opencv-python pillow
python app.py
```

### 2. Backend Server
```bash
cd server
npm install
node index.js
```

### 3. Client
```bash
cd client
npm install
npm run dev
```

## Features
- Video upload (MP4/MOV up to 100MB).
- Frame extraction at 1 FPS using FFmpeg.
- Synchronous communication with ML server.
- Real-time status and progress updates via Socket.IO.
- Persistent storage of results in MongoDB.
- Premium UI for visualization.
# novasoftware_project
