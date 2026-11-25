import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./layout/shell/app-shell').then((m) => m.AppShell),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard',
      },
      {
        path: 'dashboard',
        title: 'Dashboard | VisionLab',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'workspace',
        title: 'Detection Workspace | VisionLab',
        loadComponent: () => import('./features/workspace/workspace').then((m) => m.Workspace),
      },
      {
        path: 'analytics',
        title: 'Analytics | VisionLab',
        loadComponent: () => import('./features/analytics/analytics').then((m) => m.Analytics),
      },
      {
        path: 'history',
        title: 'Detection History | VisionLab',
        loadComponent: () => import('./features/history/history').then((m) => m.History),
      },
      {
        path: 'history/:id',
        title: 'Detection Details | VisionLab',
        loadComponent: () =>
          import('./features/history-detail/history-detail').then((m) => m.HistoryDetail),
      },
      {
        path: 'monitoring',
        title: 'Model Monitoring | VisionLab',
        loadComponent: () => import('./features/monitoring/monitoring').then((m) => m.Monitoring),
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
