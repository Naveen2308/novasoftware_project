from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
from ultralytics import YOLO
import cv2
import numpy as np
import io
import os
import json
import subprocess
from PIL import Image

app = Flask(__name__)
CORS(app)

# Load YOLO model at startup
model = YOLO("yolov8n.pt")

def get_ffmpeg_path():
    """Returns the path to the local ffmpeg binary if it exists, otherwise 'ffmpeg'"""
    local_path = os.path.join(os.path.dirname(__file__), 'bin', 'ffmpeg.exe')
    if os.path.exists(local_path):
        print(f"Using local ffmpeg: {local_path}")
        return local_path
    return 'ffmpeg'


@app.route('/detect', methods=['POST'])
def detect():
    """Single image detection endpoint (kept for backwards compat)"""
    if 'image' not in request.files:
        return jsonify({"error": "No image provided"}), 400
    
    file = request.files['image']
    save_name = request.form.get('filename', 'output.jpg')
    upload_id = request.form.get('uploadId', 'default')
    
    img_bytes = file.read()
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    img_cv = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
    
    results = model(img_cv, verbose=False)[0]
    
    processed_dir = os.path.join('outputs', f'processed_{upload_id}')
    os.makedirs(processed_dir, exist_ok=True)
    
    res_plotted = results.plot()
    cv2.imwrite(os.path.join(processed_dir, save_name), res_plotted)
    
    detections = []
    for box in results.boxes:
        coords = box.xyxy[0].tolist()
        label = model.names[int(box.cls[0])]
        confidence = float(box.conf[0])
        detections.append({
            "bbox": coords,
            "label": label,
            "confidence": confidence
        })
    
    return jsonify({
        "detections": detections,
        "output_path": f"/outputs/processed_{upload_id}/{save_name}"
    })


@app.route('/detect-video', methods=['POST'])
def detect_video():
    """
    Full video detection endpoint.
    Processes every frame at native fps with YOLO,
    pipes annotated frames to ffmpeg for smooth H.264 output,
    and streams progress back as NDJSON.
    """
    video_path = request.form.get('videoPath')
    upload_id = request.form.get('uploadId', 'default')
    
    if not video_path or not os.path.exists(video_path):
        return jsonify({"error": f"Video file not found at: {video_path}"}), 400
    
    def generate():
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            yield json.dumps({"type": "error", "message": "Failed to open video file"}) + "\n"
            return
        
        fps = cap.get(cv2.CAP_PROP_FPS) or 30
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        # Prepare output directory
        output_dir = 'outputs'
        os.makedirs(output_dir, exist_ok=True)
        output_filename = f'detected_{upload_id}.mp4'
        output_path = os.path.join(output_dir, output_filename)
        
        # Use ffmpeg pipe for browser-compatible H.264 output at native fps
        ffmpeg_cmd = [
            get_ffmpeg_path(), '-y',
            '-f', 'rawvideo',
            '-vcodec', 'rawvideo',
            '-s', f'{width}x{height}',
            '-pix_fmt', 'bgr24',
            '-r', str(fps),
            '-i', '-',
            '-an',
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            '-preset', 'fast',
            '-crf', '23',
            output_path
        ]
        
        proc = subprocess.Popen(
            ffmpeg_cmd,
            stdin=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL
        )
        
        # Send initial info
        yield json.dumps({
            "type": "info",
            "fps": fps,
            "width": width,
            "height": height,
            "totalFrames": total_frames
        }) + "\n"
        
        results_by_second = {}
        recorded_seconds = set()
        frame_idx = 0
        # Report progress every second worth of frames
        progress_interval = max(1, int(fps))
        
        print(f"[ML] Processing video: {width}x{height} @ {fps}fps, {total_frames} frames")
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            # Run YOLO detection on every frame
            result = model(frame, verbose=False)[0]
            annotated = result.plot()
            
            # Pipe annotated frame to ffmpeg
            try:
                proc.stdin.write(annotated.tobytes())
            except BrokenPipeError:
                print(f"[ML] ffmpeg pipe broken at frame {frame_idx}")
                break
            
            # Record detections only from the FIRST frame of each second
            # (all frames get YOLO drawn for the video, but only 1 per second for the timeline)
            second = int(frame_idx / fps)
            if second not in recorded_seconds:
                recorded_seconds.add(second)
                dets = []
                for box in result.boxes:
                    coords = box.xyxy[0].tolist()
                    label = model.names[int(box.cls[0])]
                    confidence = float(box.conf[0])
                    dets.append({
                        "bbox": coords,
                        "label": label,
                        "confidence": confidence
                    })
                results_by_second[second] = dets
            
            frame_idx += 1
            
            # Emit progress at regular intervals
            if frame_idx % progress_interval == 0:
                yield json.dumps({
                    "type": "progress",
                    "current": frame_idx,
                    "total": total_frames
                }) + "\n"
        
        cap.release()
        
        # Finalize ffmpeg
        if proc.stdin:
            try:
                proc.stdin.close()
            except Exception:
                pass
        proc.wait()
        
        print(f"[ML] Video processing complete: {frame_idx} frames, {len(results_by_second)} seconds")
        
        # Build final results array (sorted by timestamp)
        results = []
        for sec in sorted(results_by_second.keys()):
            results.append({
                "timestamp": sec,
                "detections": results_by_second[sec]
            })
        
        # Send final result
        yield json.dumps({
            "type": "result",
            "results": results,
            "outputPath": f"/outputs/{output_filename}",
            "fps": fps,
            "totalFrames": frame_idx,
            "totalSeconds": len(results_by_second)
        }) + "\n"
    
    return Response(
        stream_with_context(generate()),
        mimetype='application/x-ndjson',
        headers={
            'X-Accel-Buffering': 'no',
            'Cache-Control': 'no-cache'
        }
    )


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
