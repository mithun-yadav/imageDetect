import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { Header } from '../header/header';
import { Sidebar } from '../sidebar/sidebar';

@Component({
  selector: 'cv-app-shell',
  standalone: true,
  imports: [RouterOutlet, Header, Sidebar],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
})
export class AppShell {
  protected readonly isMobileNavigationOpen = signal(false);

  protected toggleMobileNavigation(): void {
    this.isMobileNavigationOpen.update((open) => !open);
  }

  protected closeMobileNavigation(): void {
    this.isMobileNavigationOpen.set(false);
  }
}
