export interface Detection {
  label: string;
  confidence: number;
  bbox: [number, number, number, number];
}

export interface ProcessingResult {
  timestamp: number;
  detections: Detection[];
}

export interface Video {
  uploadId: string;
  filename: string;
  originalName: string;
  status: 'idle' | 'uploading' | 'extracting' | 'detecting' | 'completed' | 'failed';
  timestamps: string;
  outputVideo?: string;
  results?: ProcessingResult[];
  videoWidth?: number;
  videoHeight?: number;
}

export interface ProcessingProgress {
  uploadId: string;
  current: number;
  total: number;
}

export interface StatusUpdate {
  uploadId: string;
  status: string;
}
