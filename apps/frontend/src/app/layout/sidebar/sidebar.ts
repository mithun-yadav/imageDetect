import { Component, EventEmitter, Output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface NavigationItem {
  label: string;
  route: string;
  icon: string;
  exact?: boolean;
}

@Component({
  selector: 'cv-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  @Output() readonly navigate = new EventEmitter<void>();

  protected readonly primaryNavigation: NavigationItem[] = [
    { label: 'Dashboard', route: '/dashboard', icon: 'grid', exact: true },
    { label: 'Detection Workspace', route: '/workspace', icon: 'scan' },
  ];

  protected readonly secondaryNavigation: NavigationItem[] = [
    { label: 'Analytics', route: '/analytics', icon: 'chart' },
    { label: 'Detection History', route: '/history', icon: 'history' },
    { label: 'Model Monitoring', route: '/monitoring', icon: 'activity' },
  ];
}
