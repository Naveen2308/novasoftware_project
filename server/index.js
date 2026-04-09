require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const { Server } = require('socket.io');
const http = require('http');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const axios = require('axios');
const FormData = require('form-data');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/outputs', express.static(path.join(__dirname, 'outputs')));
// Use absolute path for ML outputs to be safe
const mlOutputsPath = path.resolve(__dirname, '..', 'ml-server', 'outputs');
app.use('/ml-outputs', express.static(mlOutputsPath, {
    setHeaders: (res, path) => {
        if (path.endsWith('.mp4')) {
            res.setHeader('Content-Type', 'video/mp4');
        }
    }
}));
console.log('Serving ML outputs from:', mlOutputsPath);

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.error('MongoDB Error:', err));

// Video Schema
const videoSchema = new mongoose.Schema({
    uploadId: { type: String, required: true, unique: true },
    filename: { type: String, required: true },
    originalName: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'extracting', 'detecting', 'completed', 'failed'], default: 'pending' },
    results: { type: Array, default: [] },
    outputVideo: { type: String },
    timestamps: { type: Date, default: Date.now }
});
const Video = mongoose.model('Video', videoSchema);

// Multer Setup
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, `${uuidv4()}${path.extname(file.originalname)}`);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
    fileFilter: (req, file, cb) => {
        const filetypes = /mp4|mov/;
        const ext = path.extname(file.originalname).toLowerCase();
        if (filetypes.test(ext)) return cb(null, true);
        cb(new Error('Only mp4/mov allowed'));
    }
});

// Ensure folders exist
if (!fs.existsSync('./uploads')) fs.mkdirSync('./uploads');
if (!fs.existsSync('./outputs')) fs.mkdirSync('./outputs');
const TEMP_FRAMES_DIR = './temp_frames';
if (!fs.existsSync(TEMP_FRAMES_DIR)) fs.mkdirSync(TEMP_FRAMES_DIR);

app.get('/api/ping', (req, res) => res.json({ message: 'pong', time: new Date() }));

// Endpoints
app.post('/api/upload', upload.single('video'), async (req, res) => {
    try {
        console.log('Upload request received');
        if (!req.file) {
            console.log('No file in request');
            return res.status(400).json({ error: 'No video file' });
        }
        
        console.log(`File received: ${req.file.filename}`);
        const uploadId = uuidv4();
        const video = new Video({ 
            uploadId, 
            filename: req.file.filename,
            originalName: req.file.originalname || req.file.filename,
            status: 'pending'
        });
        console.log('Saving video to DB...');
        await video.save();
        console.log('Video saved successfully');

        res.status(202).json({ uploadId, message: 'Upload successful, processing started' });

        processVideo(video);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/status/:uploadId', async (req, res) => {
    const video = await Video.findOne({ uploadId: req.params.uploadId });
    if (!video) return res.status(404).json({ error: 'Not found' });
    res.json({ status: video.status });
});

app.get('/api/results/:uploadId', async (req, res) => {
    const video = await Video.findOne({ uploadId: req.params.uploadId });
    if (!video) return res.status(404).json({ error: 'Not found' });
    res.json(video.results);
});

app.get('/api/history', async (req, res) => {
    try {
        console.log('Fetching history...');
        const history = await Video.find().sort({ timestamps: -1 });
        console.log(`Found ${history.length} items in history`);
        res.json(history);
    } catch (err) {
        console.error('History fetch error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/video/:uploadId', async (req, res) => {
    try {
        console.log(`Fetching video data for ${req.params.uploadId}...`);
        const video = await Video.findOne({ uploadId: req.params.uploadId });
        if (!video) {
            console.log('Video not found');
            return res.status(404).json({ error: 'Video not found' });
        }
        res.json(video);
    } catch (err) {
        console.error('Video fetch error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

async function processVideo(video) {
    try {
        // Set status to detecting — no more frame extraction step
        console.log(`[${video.uploadId}] Starting full-video detection at native fps...`);
        video.status = 'detecting';
        await video.save();
        io.emit('statusUpdate', { uploadId: video.uploadId, status: 'detecting' });

        const videoPath = path.resolve(__dirname, 'uploads', video.filename);
        
        // Build ML server base URL from env
        const mlBase = (process.env.ML_SERVER_URL || 'http://127.0.0.1:5001/detect').replace('/detect', '');
        const ML_VIDEO_URL = `${mlBase}/detect-video`;
        console.log(`[${video.uploadId}] Sending to ML server: ${ML_VIDEO_URL}`);
        console.log(`[${video.uploadId}] Video path: ${videoPath}`);

        // Send video path to ML server — streams back NDJSON progress + results
        const formData = new FormData();
        formData.append('videoPath', videoPath);
        formData.append('uploadId', video.uploadId);

        const response = await axios({
            method: 'post',
            url: ML_VIDEO_URL,
            data: formData,
            headers: formData.getHeaders(),
            responseType: 'stream',
            timeout: 0, // No timeout for long video processing
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
        });

        let resultData = null;

        await new Promise((resolve, reject) => {
            let buffer = '';

            response.data.on('data', (chunk) => {
                buffer += chunk.toString();
                const lines = buffer.split('\n');
                buffer = lines.pop(); // Keep incomplete line in buffer

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const data = JSON.parse(line);
                        if (data.type === 'progress') {
                            io.emit('processingProgress', {
                                uploadId: video.uploadId,
                                current: data.current,
                                total: data.total
                            });
                        } else if (data.type === 'result') {
                            resultData = data;
                            console.log(`[${video.uploadId}] ML processing complete: ${data.totalFrames} frames, ${data.totalSeconds}s of detections`);
                        } else if (data.type === 'info') {
                            console.log(`[${video.uploadId}] Video: ${data.width}x${data.height} @ ${data.fps}fps, ${data.totalFrames} total frames`);
                        } else if (data.type === 'error') {
                            console.error(`[${video.uploadId}] ML error: ${data.message}`);
                        }
                    } catch (e) {
                        // Ignore parse errors for partial lines
                    }
                }
            });

            response.data.on('end', () => resolve());
            response.data.on('error', (err) => reject(err));
        });

        if (!resultData) {
            throw new Error('No result data received from ML server');
        }

        // Save completed status
        const outputVideoName = `detected_${video.uploadId}.mp4`;
        console.log(`[${video.uploadId}] Saving results to DB...`);
        video.status = 'completed';
        video.results = resultData.results;
        video.outputVideo = `/ml-outputs/${outputVideoName}`;
        await video.save();

        io.emit('statusUpdate', {
            uploadId: video.uploadId,
            status: 'completed',
            results: resultData.results,
            outputVideo: `/ml-outputs/${outputVideoName}`
        });
        console.log(`[${video.uploadId}] ✅ Completed! Output: ${outputVideoName}`);

    } catch (err) {
        console.error(`[${video.uploadId}] Processing failed:`, err.message);
        video.status = 'failed';
        await video.save();
        io.emit('statusUpdate', { uploadId: video.uploadId, status: 'failed' });
    }
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Backend Server running on port ${PORT}`));
