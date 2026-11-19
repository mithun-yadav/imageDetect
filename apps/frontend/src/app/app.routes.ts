import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./layout/shell/app-shell').then((m) => m.AppShell),
    children: [],
  },
];
