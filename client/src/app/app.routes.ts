import { Routes } from '@angular/router';
import { UploadComponent } from './components/upload.component';
import { AnalysisComponent } from './components/analysis.component';

export const routes: Routes = [
  { path: '', component: UploadComponent },
  { path: ':id', component: AnalysisComponent },
  { path: '**', redirectTo: '' }
];
