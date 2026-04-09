import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LucideDynamicIcon } from '@lucide/angular';
import { Video } from '../models/video.model';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideDynamicIcon],
  templateUrl: './sidebar.component.html'
})
export class SidebarComponent {
  @Input() history: Video[] = [];
  @Input() activeId?: string;
}
