import { Component, OnInit, OnDestroy, signal, ViewChild, ElementRef, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { LucideDynamicIcon } from '@lucide/angular';
import { VideoService } from '../services/video.service';
import { SocketService } from '../services/socket.service';
import { Video, ProcessingProgress } from '../models/video.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-analysis',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideDynamicIcon],
  templateUrl: './analysis.component.html'
})
export class AnalysisComponent implements OnInit, OnDestroy {
  @ViewChild('origVid') videoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('detectedVideoRef') detectedVideoRef!: ElementRef<HTMLVideoElement>;

  id = signal<string | null>(null);
  selectedVideo = signal<Video | null>(null);
  status = signal<string>('loading');
  processingProgress = signal<ProcessingProgress | null>(null);
  currentTime = signal(0);
  error = signal<string | null>(null);
  videoTab = signal<'original' | 'detected'>('detected');

  private subscriptions = new Subscription();
  private readonly API_BASE = `${window.location.protocol}//${window.location.hostname}:5000`;

  constructor(
    private route: ActivatedRoute,
    private videoService: VideoService,
    private socketService: SocketService
  ) {}

  ngOnInit(): void {
    this.subscriptions.add(
      this.route.params.subscribe(params => {
        const newId = params['id'];
        this.id.set(newId);
        if (newId) {
          this.fetchVideoData(newId);
        }
      })
    );

    this.subscriptions.add(
      this.socketService.getStatusUpdates().subscribe(data => {
        if (data.uploadId === this.id()) {
          this.status.set(data.status);
          if (data.status === 'completed') {
            this.fetchVideoData(data.uploadId);
            this.videoService.fetchHistory();
          }
        }
      })
    );

    this.subscriptions.add(
      this.socketService.getProgressUpdates().subscribe(data => {
        if (data.uploadId === this.id()) {
          this.processingProgress.set(data);
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  fetchVideoData(uid: string): void {
    this.error.set(null);
    this.videoService.fetchVideo(uid).subscribe({
      next: (video) => {
        this.selectedVideo.set(video);
        this.status.set(video.status);
        if (video.status === 'completed' && video.outputVideo) {
          this.videoTab.set('detected');
        }
      },
      error: (err) => {
        console.error('Fetch video data failed:', err);
        this.error.set(err.error?.error || 'Failed to load video data.');
      }
    });
  }

  seekTo(seconds: number): void {
    const activeRef = this.videoTab() === 'original' ? this.videoRef : this.detectedVideoRef;
    if (activeRef?.nativeElement) {
      activeRef.nativeElement.currentTime = seconds;
      activeRef.nativeElement.play();
    }
  }

  handleTabSwitch(tab: 'original' | 'detected'): void {
    const currentRef = tab === 'original' ? this.detectedVideoRef : this.videoRef;
    const time = currentRef?.nativeElement?.currentTime || 0;
    this.videoTab.set(tab);

    setTimeout(() => {
      const newRef = tab === 'original' ? this.videoRef : this.detectedVideoRef;
      if (newRef?.nativeElement) {
        newRef.nativeElement.currentTime = time;
      }
    }, 100);
  }

  onTimeUpdate(event: Event): void {
    this.currentTime.set((event.target as HTMLVideoElement).currentTime);
  }

  get currentDetections() {
    const video = this.selectedVideo();
    const time = Math.floor(this.currentTime());
    return video?.results?.find(r => r.timestamp === time)?.detections || [];
  }

  get apiBase() { return this.API_BASE; }

  exportJson(): void {
    const video = this.selectedVideo();
    if (!video?.results) return;
    const blob = new Blob([JSON.stringify(video.results, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `detections-${video.uploadId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
