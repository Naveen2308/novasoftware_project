import { Component, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideDynamicIcon } from '@lucide/angular';
import { VideoService } from '../services/video.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule, LucideDynamicIcon],
  templateUrl: './upload.component.html'
})
export class UploadComponent {
  @Output() uploadComplete = new EventEmitter<string>();

  file = signal<File | null>(null);
  status = signal<'idle' | 'uploading'>('idle');
  uploadProgress = signal(0);

  constructor(private videoService: VideoService, private router: Router) {}

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.file.set(input.files[0]);
    }
  }

  handleDrop(event: DragEvent): void {
    event.preventDefault();
    if (this.status() === 'idle' && event.dataTransfer?.files?.length) {
      this.file.set(event.dataTransfer.files[0]);
    }
  }

  handleUpload(): void {
    const file = this.file();
    if (!file) return;

    this.status.set('uploading');
    this.videoService.uploadVideo(file).subscribe({
      next: (event) => {
        if (event.status === 'progress') {
          this.uploadProgress.set(event.message);
        } else if (event.status === 'completed') {
          const newUploadId = event.message.uploadId;
          this.file.set(null);
          this.status.set('idle');
          this.uploadProgress.set(0);
          this.uploadComplete.emit(newUploadId);
          this.router.navigate(['/', newUploadId]);
        }
      },
      error: (err) => {
        console.error(err);
        this.status.set('idle');
        this.uploadProgress.set(0);
        alert('Upload failed. Please try again.');
      }
    });
  }
}
