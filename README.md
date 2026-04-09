# ObjectEye Monorepo

A complete video processing system with real-time AI object detection.

## Demo Video
<video src="resources/video.mp4" controls width="100%"></video>

## Structure
- `/client`: Angular 19 + TypeScript + Tailwind frontend.
- `/server`: Node.js + Express + Socket.IO + Mongoose backend.
- `/ml-server`: Flask + YOLOv8 object detection server.

## API Documentation

### Backend Server (Port 5000)

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/ping` | `GET` | Health check endpoint. |
| `/api/upload` | `POST` | Upload a video file to start processing. Expects `multipart/form-data` with a `video` field. |
| `/api/status/:uploadId` | `GET` | Get current processing status of a video. |
| `/api/results/:uploadId` | `GET` | Get final detection results for a specific upload. |
| `/api/history` | `GET` | Returns list of all processed/recent videos. |
| `/api/video/:uploadId` | `GET` | Returns full document for a specific video. |
| `/ml-outputs/:filename`| `GET` | Static proxy for annotated output videos. |

### ML Server (Port 5001)

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/detect` | `POST` | YOLO detection on a single image (legacy). |
| `/detect-video` | `POST` | Full video detection. Streams progress and results as `application/x-ndjson`. |

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
- Full Video analysis at native frame rates.
- H.264 smooth video output with annotated bounding boxes.
- Real-time progress tracking via Socket.IO.
- Interactive timeline to jump to specific object detections.
- Premium dark-themed UI (Glassmorphism).

# novasoftware_project
