import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { 
  provideLucideIcons, 
  LucideUpload, 
  LucideVideo, 
  LucideActivity, 
  LucideCheckCircle, 
  LucideClock, 
  LucidePlay, 
  LucideHistory, 
  LucideLoader2, 
  LucideSearch, 
  LucideTimer, 
  LucideHome, 
  LucideArrowLeft 
} from '@lucide/angular';


import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withFetch()),
    provideLucideIcons(
      LucideUpload,
      LucideVideo,
      LucideActivity,
      LucideCheckCircle,
      LucideClock,
      LucidePlay,
      LucideHistory,
      LucideLoader2,
      LucideSearch,
      LucideTimer,
      LucideHome,
      LucideArrowLeft
    )
  ]
};
