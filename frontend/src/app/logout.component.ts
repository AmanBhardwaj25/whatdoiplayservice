import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-logout',
  templateUrl: './logout.component.html',
  styleUrl: './logout.component.css'
})
export class LogoutComponent {
  @Input({ required: true }) backendBaseUrl = '';
  @Output() loggedOut = new EventEmitter<void>();

  async logout(): Promise<void> {
    const baseUrl = this.backendBaseUrl.trim().replace(/\/$/, '');

    try {
      await fetch(`${baseUrl}/logout`, {
        method: 'GET',
        credentials: 'include',
        redirect: 'follow'
      });
    } finally {
      this.loggedOut.emit();
    }
  }
}
