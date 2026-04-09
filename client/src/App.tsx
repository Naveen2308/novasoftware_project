import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import { Upload, Video, Activity, CheckCircle, Clock, Play, History, Loader2, Search, Timer, Home, ArrowLeft } from 'lucide-react';
import { Routes, Route, useNavigate, useParams, Link, useLocation } from 'react-router-dom';

const API_BASE = `${window.location.protocol}//${window.location.hostname}:5000`;

// Create socket once, outside component
let socket: Socket;
function getSocket() {
  if (!socket) {
    socket = io(API_BASE, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  }
  return socket;
}

/* ─── Sidebar Component ─── */
function Sidebar({ history, activeId }: { history: any[]; activeId?: string }) {
  return (
    <aside className="w-80 border-r border-slate-800 bg-slate-900/30 flex flex-col">
      <Link to="/" className="p-6 border-b border-slate-800 flex items-center gap-3 hover:bg-slate-800/50 transition-colors">
        <Home className="text-indigo-500 w-5 h-5" />
        <h2 className="font-bold text-lg">Home</h2>
      </Link>
      <div className="p-4 border-b border-slate-800 flex items-center gap-2 text-slate-400">
        <History className="w-4 h-4" />
        <span className="text-xs font-bold uppercase tracking-widest">History</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {history.length === 0 ? (
          <p className="text-slate-500 text-sm text-center mt-10 italic">No history yet</p>
        ) : (
          history.map((item) => (
            <Link
              to={`/${item.uploadId}`}
              key={item.uploadId}
              className={`block p-4 rounded-xl border transition-all cursor-pointer group ${
                activeId === item.uploadId
                  ? 'bg-indigo-600/10 border-indigo-500'
                  : 'bg-slate-900/50 border-slate-800 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-slate-800 rounded-lg group-hover:bg-indigo-600/20 transition-colors">
                  <Video className="w-4 h-4 text-slate-400 group-hover:text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{item.originalName || item.filename}</p>
                  <p className="text-[10px] text-slate-500">
                    {new Date(item.timestamps).toLocaleDateString()} • {new Date(item.timestamps).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-[9px] uppercase font-black tracking-widest ${
                  item.status === 'completed' ? 'text-emerald-500' : item.status === 'failed' ? 'text-rose-500' : 'text-amber-500'
                }`}>
                  {item.status}
                </span>
                <Play className="w-3 h-3 text-slate-600 group-hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-all" />
              </div>
            </Link>
          ))
        )}
      </div>
    </aside>
  );
}

/* ─── Upload Page Component ─── */
function UploadPage({ onUploadComplete }: { onUploadComplete: (uploadId: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading'>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const navigate = useNavigate();

  const handleUpload = async () => {
    if (!file) return;
    const formData = new FormData();
    formData.append('video', file);

    try {
      setStatus('uploading');
      const res = await axios.post(`${API_BASE}/api/upload`, formData, {
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 100));
          setUploadProgress(percentCompleted);
        }
      });
      const newUploadId = res.data.uploadId;
      setFile(null);
      setStatus('idle');
      setUploadProgress(0);
      onUploadComplete(newUploadId);
      navigate(`/${newUploadId}`);
    } catch (err) {
      console.error(err);
      setStatus('idle');
      setUploadProgress(0);
      alert('Upload failed. Please try again.');
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-12 bg-slate-900/50 rounded-3xl border border-slate-800 text-center space-y-8 mt-10">
      <div
        className={`relative border-2 border-dashed rounded-2xl p-16 transition-all group flex flex-col items-center justify-center ${
          status === 'uploading'
            ? 'border-indigo-500/50 bg-indigo-500/5'
            : 'border-slate-700 hover:border-indigo-500 cursor-pointer'
        }`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (status === 'idle') {
            setFile(e.dataTransfer.files?.[0] || null);
          }
        }}
      >
        <input
          type="file"
          accept="video/mp4,video/quicktime,.mp4,.mov"
          className="absolute inset-0 opacity-0 cursor-pointer"
          disabled={status === 'uploading'}
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />

        {status === 'idle' && (
          <>
            <Upload className="w-16 h-16 mx-auto mb-4 text-slate-500 group-hover:text-indigo-400 transition-colors" />
            <p className="text-slate-400 font-medium text-lg">
              {file ? file.name : 'Drag & drop your video here'}
            </p>
            <p className="text-slate-500 text-sm mt-2">or click to browse (MP4/MOV, max 100MB)</p>
          </>
        )}

        {status === 'uploading' && (
          <div className="w-full max-w-sm text-center">
            <Loader2 className="w-12 h-12 mx-auto mb-4 text-indigo-400 animate-spin" />
            <p className="text-indigo-300 font-bold mb-4 animate-pulse">Uploading... {uploadProgress}%</p>
            <div className="w-full bg-slate-800 rounded-full h-2">
              <div className="bg-indigo-500 h-2 rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(99,102,241,0.5)]" style={{ width: `${uploadProgress}%` }}></div>
            </div>
          </div>
        )}
      </div>
      <button
        onClick={handleUpload}
        disabled={!file || status !== 'idle'}
        className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 rounded-2xl font-black transition-all text-sm uppercase tracking-widest shadow-2xl shadow-indigo-900/40 flex items-center justify-center gap-3 overflow-hidden group relative"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
        <Play className="w-5 h-5" />
        Analyze Video
      </button>
    </div>
  );
}

/* ─── Analysis Page Component ─── */
function AnalysisPage({ onRefreshHistory }: { onRefreshHistory: () => void }) {
  const { id } = useParams<{ id: string }>();
  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  const [status, setStatus] = useState<string>('loading');
  const [processingProgress, setProcessingProgress] = useState<{ current: number; total: number } | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [videoTab, setVideoTab] = useState<'original' | 'detected'>('detected');
  const videoRef = useRef<HTMLVideoElement>(null);
  const detectedVideoRef = useRef<HTMLVideoElement>(null);
  const idRef = useRef(id);

  // Keep ref in sync
  useEffect(() => {
    idRef.current = id;
  }, [id]);

  const fetchVideoData = useCallback(async (uid: string) => {
    try {
      setError(null);
      const res = await axios.get(`${API_BASE}/api/video/${uid}`);
      setSelectedVideo(res.data);
      setStatus(res.data.status);
      // Auto-switch to detected tab when completed
      if (res.data.status === 'completed' && res.data.outputVideo) {
        setVideoTab('detected');
      }
    } catch (err: any) {
      console.error('Fetch video data failed:', err);
      setError(err.response?.data?.error || 'Failed to load video data. Please ensure the backend is running.');
    }
  }, []);

  // Fetch video data when id changes
  useEffect(() => {
    if (id) {
      fetchVideoData(id);
    }
  }, [id, fetchVideoData]);

  // Socket listeners — scoped to this component which has the correct `id`
  useEffect(() => {
    const s = getSocket();

    const handleStatus = (data: any) => {
      if (data.uploadId === idRef.current) {
        setStatus(data.status);
        if (data.status === 'completed') {
          fetchVideoData(data.uploadId);
          onRefreshHistory();
        }
      }
    };

    const handleProgress = (data: any) => {
      if (data.uploadId === idRef.current) {
        setProcessingProgress({ current: data.current, total: data.total });
      }
    };

    s.on('statusUpdate', handleStatus);
    s.on('processingProgress', handleProgress);

    return () => {
      s.off('statusUpdate', handleStatus);
      s.off('processingProgress', handleProgress);
    };
  }, [id, fetchVideoData, onRefreshHistory]);

  const seekTo = (seconds: number) => {
    const activeRef = videoTab === 'original' ? videoRef : detectedVideoRef;
    if (activeRef.current) {
      activeRef.current.currentTime = seconds;
      activeRef.current.play();
    }
  };

  // Sync playback position across tabs
  const handleTabSwitch = (tab: 'original' | 'detected') => {
    const currentRef = tab === 'original' ? detectedVideoRef : videoRef;
    const time = currentRef.current?.currentTime || 0;
    setVideoTab(tab);
    // After React renders the new video, seek to the same position
    setTimeout(() => {
      const newRef = tab === 'original' ? videoRef : detectedVideoRef;
      if (newRef.current) {
        newRef.current.currentTime = time;
      }
    }, 100);
  };

  const currentDetections = selectedVideo?.results?.find((r: any) => Math.floor(currentTime) === r.timestamp)?.detections || [];

  const hasDetectedVideo = status === 'completed' && selectedVideo?.outputVideo;

  return (
    <div className="space-y-8">
      {/* Main Workspace */}
      <div className="grid grid-cols-1 gap-8">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-4">
              <Link to="/" className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors">
                <ArrowLeft className="w-4 h-4 text-slate-400" />
              </Link>
              <div className="flex flex-col">
                <h2 className="text-xl font-black text-white">{selectedVideo?.originalName || selectedVideo?.filename || 'Loading...'}</h2>
                {hasDetectedVideo && (
                  <a
                    href={`${API_BASE}${selectedVideo.outputVideo}`}
                    download
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 mt-1 transition-colors"
                  >
                    <CheckCircle className="w-3 h-3" /> Download Processed MP4 (with boxes)
                  </a>
                )}
              </div>
            </div>
            {status === 'completed' && (
              <span className="text-xs text-indigo-400 font-bold bg-indigo-500/10 px-3 py-1 rounded-lg border border-indigo-500/20">Analysis Ready</span>
            )}
          </div>

          {/* Video Tab Switcher */}
          {hasDetectedVideo && (
            <div className="flex items-center gap-1 px-2">
              <button
                onClick={() => handleTabSwitch('original')}
                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                  videoTab === 'original'
                    ? 'bg-slate-700 text-white shadow-lg border border-slate-600'
                    : 'bg-slate-900/50 text-slate-500 border border-slate-800 hover:text-slate-300 hover:border-slate-600'
                }`}
              >
                <Video className="w-3.5 h-3.5" />
                Original Video
              </button>
              <button
                onClick={() => handleTabSwitch('detected')}
                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                  videoTab === 'detected'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40 border border-indigo-500'
                    : 'bg-slate-900/50 text-slate-500 border border-slate-800 hover:text-slate-300 hover:border-slate-600'
                }`}
              >
                <Search className="w-3.5 h-3.5" />
                Detection View
                <span className="px-1.5 py-0.5 bg-white/20 rounded text-[9px]">AI</span>
              </button>
            </div>
          )}

          {/* Video Player */}
          <div className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden aspect-video relative flex items-center justify-center group/player">
            {error ? (
              <div className="text-center p-8 space-y-4">
                <Activity className="w-12 h-12 mx-auto text-rose-500" />
                <p className="text-rose-400 font-bold">{error}</p>
                <div className="flex items-center justify-center gap-3">
                  <button onClick={() => id && fetchVideoData(id)} className="px-4 py-2 bg-slate-800 rounded-lg text-xs hover:bg-slate-700 transition-colors">Retry Connection</button>
                  <Link to="/" className="px-4 py-2 bg-indigo-600 rounded-lg text-xs hover:bg-indigo-500 transition-colors font-bold">Go Home</Link>
                </div>
              </div>
            ) : selectedVideo ? (
              <div className="relative w-full h-full flex items-center justify-center">
                {/* Original Video */}
                {(videoTab === 'original' || !hasDetectedVideo) && (
                  <video
                    key={`original-${selectedVideo.uploadId}`}
                    ref={videoRef}
                    src={`${API_BASE}/uploads/${selectedVideo.filename}`}
                    controls
                    preload="auto"
                    onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                    className="w-full h-full object-contain"
                  />
                )}

                {/* Detected Video (with YOLO bounding boxes burned in) */}
                {videoTab === 'detected' && hasDetectedVideo && (
                  <video
                    key={`detected-${selectedVideo.uploadId}`}
                    ref={detectedVideoRef}
                    src={`${API_BASE}${selectedVideo.outputVideo}`}
                    controls
                    preload="auto"
                    onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                    className="w-full h-full object-contain"
                  />
                )}

                {/* Live Bounding Box Overlay — only on original video tab */}
                {videoTab === 'original' && status === 'completed' && currentDetections.length > 0 && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="relative" style={{
                      width: videoRef.current ? (videoRef.current.clientWidth) : '100%',
                      height: videoRef.current ? (videoRef.current.clientHeight) : '100%'
                    }}>
                      {currentDetections.map((det: any, i: number) => {
                        const video = videoRef.current;
                        if (!video) return null;
                        const scaleX = video.clientWidth / video.videoWidth;
                        const scaleY = video.clientHeight / video.videoHeight;

                        return (
                          <div
                            key={i}
                            className="absolute border-2 border-indigo-500 bg-indigo-500/20 rounded shadow-[0_0_10px_rgba(99,102,241,0.5)] flex flex-col justify-start"
                            style={{
                              left: `${det.bbox[0] * scaleX}px`,
                              top: `${det.bbox[1] * scaleY}px`,
                              width: `${(det.bbox[2] - det.bbox[0]) * scaleX}px`,
                              height: `${(det.bbox[3] - det.bbox[1]) * scaleY}px`,
                            }}
                          >
                            <span className="bg-indigo-500 text-white text-[8px] font-bold px-1 py-0.5 rounded-br w-fit whitespace-nowrap">
                              {det.label} {(det.confidence * 100).toFixed(0)}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Tab indicator overlay */}
                {hasDetectedVideo && (
                  <div className="absolute top-4 right-4 z-10">
                    <div className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest backdrop-blur-md border ${
                      videoTab === 'detected' 
                        ? 'bg-indigo-600/80 border-indigo-400/50 text-white' 
                        : 'bg-slate-900/80 border-slate-700 text-slate-300'
                    }`}>
                      {videoTab === 'detected' ? '🔍 Detection View' : '🎬 Original'}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center p-8">
                <Loader2 className="w-12 h-12 mx-auto mb-4 text-slate-700 animate-spin" />
                <p className="text-slate-500 text-sm">Loading video data...</p>
              </div>
            )}

            {/* Overlay for processing */}
            {selectedVideo && status !== 'completed' && status !== 'loading' && status !== 'failed' && (
              <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-20">
                <div className="text-center space-y-4 max-w-md w-full px-6">
                  <div className="relative">
                    <Loader2 className="w-16 h-16 mx-auto text-indigo-500 animate-spin" />
                    <Activity className="w-6 h-6 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white animate-pulse" />
                  </div>
                  <div>
                    <p className="text-indigo-400 font-black uppercase tracking-tighter text-2xl animate-pulse">{status}...</p>
                    <p className="text-slate-400 text-sm font-medium">Stage: {status === 'extracting' ? 'Extracting Frames' : status === 'detecting' ? 'Object Detection pipeline active' : 'Processing'}</p>
                  </div>

                  {processingProgress && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-bold text-slate-500">
                        <span>PROGRESS</span>
                        <span>{Math.round((processingProgress.current / processingProgress.total) * 100)}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 transition-all duration-300 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                          style={{ width: `${(processingProgress.current / processingProgress.total) * 100}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-slate-500">Frame {processingProgress.current} of {processingProgress.total}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Failed overlay */}
            {selectedVideo && status === 'failed' && (
              <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-20">
                <div className="text-center space-y-4">
                  <Activity className="w-16 h-16 mx-auto text-rose-500" />
                  <p className="text-rose-400 font-black text-xl">Processing Failed</p>
                  <p className="text-slate-400 text-sm">Something went wrong during video analysis.</p>
                  <Link to="/" className="inline-block px-6 py-3 bg-indigo-600 rounded-xl text-sm font-bold hover:bg-indigo-500 transition-colors">
                    Upload Another Video
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detailed Timestamps Section */}
      {status === 'completed' && selectedVideo?.results && (
        <div className="bg-slate-900/30 p-8 rounded-3xl border border-slate-800 space-y-8">
          <div className="flex items-center justify-between border-b border-slate-800 pb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
                <Timer className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Object Timeline</h2>
                <p className="text-slate-500 text-sm font-medium">Click on any marker to jump to that moment in the video</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="px-4 py-2 bg-emerald-500/10 text-emerald-400 text-sm font-bold rounded-xl border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                {selectedVideo.results?.reduce((acc: number, r: any) => acc + r.detections.length, 0) || 0} Detections
              </div>
              <button
                onClick={() => {
                  const blob = new Blob([JSON.stringify(selectedVideo.results, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `detections-${selectedVideo.uploadId}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-black uppercase tracking-widest rounded-xl border border-slate-700 transition-all active:scale-95 flex items-center gap-2"
              >
                <Upload className="w-3.5 h-3.5 rotate-180" />
                Export JSON
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {selectedVideo.results && selectedVideo.results.length > 0 ? selectedVideo.results.map((item: any, i: number) => (
              item.detections.length > 0 && (
                <div key={i} className="space-y-3">
                  <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 tracking-tighter uppercase px-1">
                    <Clock className="w-3 h-3" /> Timestamp: {item.timestamp}s
                  </div>
                  <div className="space-y-2">
                    {item.detections.map((det: any, di: number) => (
                      <button
                        key={di}
                        onClick={() => seekTo(item.timestamp)}
                        className="w-full p-4 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500/50 rounded-2xl text-left transition-all group relative overflow-hidden active:scale-[0.98]"
                      >
                        <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-500/5 -mr-8 -mt-8 rounded-full transition-all group-hover:bg-indigo-500/10" />
                        <div className="flex items-center justify-between relative z-10 mb-2">
                          <span className="text-xs font-black text-indigo-400 uppercase tracking-widest">{det.label}</span>
                          <div className="px-2 py-0.5 bg-slate-800 rounded-md text-[9px] font-bold text-slate-500 group-hover:text-indigo-300 transition-colors">
                            {(det.confidence * 100).toFixed(1)}%
                          </div>
                        </div>
                        <div className="flex items-center justify-between relative z-10">
                          <span className="text-[10px] text-slate-500 font-medium">Click to visualize moment</span>
                          <Play className="w-3 h-3 text-indigo-500 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )
            )) : (
              <div className="col-span-full py-12 text-center bg-slate-900/20 rounded-3xl border border-dashed border-slate-800">
                <p className="text-slate-500 italic font-medium">No objects detected during the analysis scan.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main App Component ─── */
function App() {
  const [history, setHistory] = useState<any[]>([]);
  const location = useLocation();
  const activeId = location.pathname !== '/' ? location.pathname.slice(1) : undefined;

  const fetchHistory = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/history`);
      setHistory(res.data);
    } catch (err) {
      console.error('History fetch failed');
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return (
    <div className="flex h-screen bg-slate-950 text-slate-50 font-sans overflow-hidden">
      {/* Sidebar: History */}
      <Sidebar history={history} activeId={activeId} />

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-y-auto bg-slate-950 relative">
        <header className="sticky top-0 z-10 p-6 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <Video className="w-5 h-5" />
            </div>
            <Link to="/" className="text-xl font-bold tracking-tight">ObjectEye <span className="text-slate-500 font-normal">v2.0</span></Link>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900 px-3 py-1.5 rounded-full border border-slate-800">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              DeepMind Engine Online
            </div>
          </div>
        </header>

        <div className="p-8 space-y-8 max-w-full mx-auto w-full">
          <Routes>
            <Route path="/" element={<UploadPage onUploadComplete={() => fetchHistory()} />} />
            <Route path="/:id" element={<AnalysisPage onRefreshHistory={fetchHistory} />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default App;
