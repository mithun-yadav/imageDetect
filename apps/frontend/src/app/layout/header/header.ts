import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'cv-header',
  standalone: true,
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  @Output() readonly menuToggle = new EventEmitter<void>();
}
