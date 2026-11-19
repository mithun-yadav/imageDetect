import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./layout/shell/app-shell').then((m) => m.AppShell),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard',
      },
      {
        path: 'dashboard',
        title: 'Dashboard | VisionLab',
        loadComponent: () =>
          import('./features/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'workspace',
        title: 'Detection Workspace | VisionLab',
        loadComponent: () =>
          import('./features/workspace/workspace').then((m) => m.Workspace),
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
