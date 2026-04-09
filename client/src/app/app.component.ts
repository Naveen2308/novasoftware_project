import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterModule, Router, NavigationEnd } from '@angular/router';
import { LucideDynamicIcon } from '@lucide/angular';
import { SidebarComponent } from './components/sidebar.component';
import { VideoService } from './services/video.service';
import { SocketService } from './services/socket.service';
import { filter } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterModule, LucideDynamicIcon, SidebarComponent],
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {
  private videoService = inject(VideoService);
  private socketService = inject(SocketService);
  private router = inject(Router);

  activeId = signal<string | undefined>(undefined);
  
  // Expose signals from VideoService
  history = this.videoService.history;

  constructor() {
    // Track active route for sidebar highlighting
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      const path = this.router.url;
      this.activeId.set(path !== '/' ? path.slice(1) : undefined);
    });
  }

  ngOnInit(): void {
    this.videoService.fetchHistory();
  }

  onRefreshHistory(): void {
    this.videoService.fetchHistory();
  }
}
