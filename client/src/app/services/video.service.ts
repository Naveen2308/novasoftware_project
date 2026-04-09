import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { Video } from '../models/video.model';
import { Observable, map, tap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class VideoService {
  private readonly API_BASE = `${window.location.protocol}//${window.location.hostname}:5000`;

  // Reactive state using Signals
  history = signal<Video[]>([]);
  selectedVideo = signal<Video | null>(null);

  constructor(private http: HttpClient) {}

  fetchHistory(): void {
    this.http.get<Video[]>(`${this.API_BASE}/api/history`).subscribe({
      next: (data) => this.history.set(data),
      error: (err) => console.error('History fetch failed', err)
    });
  }

  fetchVideo(id: string): Observable<Video> {
    return this.http.get<Video>(`${this.API_BASE}/api/video/${id}`).pipe(
      tap(video => this.selectedVideo.set(video))
    );
  }

  uploadVideo(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('video', file);

    return this.http.post(`${this.API_BASE}/api/upload`, formData, {
      reportProgress: true,
      observe: 'events'
    }).pipe(
      map(event => {
        switch (event.type) {
          case HttpEventType.UploadProgress:
            const progress = Math.round(100 * event.loaded / (event.total || 100));
            return { status: 'progress', message: progress };
          case HttpEventType.Response:
            return { status: 'completed', message: event.body };
          default:
            return { status: 'other', message: event.type };
        }
      })
    );
  }
}
