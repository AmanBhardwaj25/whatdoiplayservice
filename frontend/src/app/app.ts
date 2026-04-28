import { Component, OnDestroy, OnInit } from '@angular/core';
import { LogoutComponent } from './logout.component';
import { StartModeCardsComponent } from './start-mode-cards.component';
import { ClassicShowdownComponent } from './classic-showdown.component';

const BACKEND_BASE_URL = 'http://localhost:3000';
const AUTH_SUCCESS_MESSAGE = 'steam-auth-success';

@Component({
  selector: 'app-root',
  imports: [LogoutComponent, StartModeCardsComponent, ClassicShowdownComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  isLoading = true;
  isAuthenticated = false;
  backendBaseUrl = BACKEND_BASE_URL;
  activeMode: 'none' | 'classic' = 'none';

  private authPopup: Window | null = null;
  private popupPollTimerId: ReturnType<typeof setInterval> | null = null;
  private faviconObjectUrl: string | null = null;

  private readonly messageHandler = (event: MessageEvent): void => {
    if (event.origin !== window.location.origin) {
      return;
    }

    if (event.data?.type === AUTH_SUCCESS_MESSAGE) {
      this.refreshAuthState();
    }
  };

  ngOnInit(): void {
    this.forceFavicon();
    window.addEventListener('message', this.messageHandler);
    this.refreshAuthState();
  }

  ngOnDestroy(): void {
    window.removeEventListener('message', this.messageHandler);
    this.stopPopupPolling();

    if (this.faviconObjectUrl) {
      URL.revokeObjectURL(this.faviconObjectUrl);
      this.faviconObjectUrl = null;
    }
  }

  loginWithSteamPopup(): void {
    const popupWidth = 540;
    const popupHeight = 720;
    const left = Math.max((window.screen.width - popupWidth) / 2, 0);
    const top = Math.max((window.screen.height - popupHeight) / 2, 0);
    const popupFeatures = `width=${popupWidth},height=${popupHeight},left=${left},top=${top},resizable,scrollbars`;

    this.authPopup = window.open(`${this.backendBaseUrl}/auth/steam`, 'steamAuthPopup', popupFeatures);

    if (!this.authPopup) {
      window.location.href = `${this.backendBaseUrl}/auth/steam`;
      return;
    }

    this.startPopupPolling();
  }

  async onLoggedOut(): Promise<void> {
    await this.refreshAuthState();
  }

  private async refreshAuthState(): Promise<void> {
    this.isLoading = true;

    try {
      const response = await fetch(`${this.backendBaseUrl}/account`, {
        method: 'GET',
        credentials: 'include'
      });

      this.isAuthenticated = response.ok;

      if (this.isAuthenticated) {
        this.activeMode = 'none';
        this.notifyOpenerAndClosePopup();
      }
    } catch (error) {
      this.isAuthenticated = false;
      this.activeMode = 'none';
    } finally {
      this.isLoading = false;
    }
  }

  startClassicMode(): void {
    this.activeMode = 'classic';
  }

  goToLandingPage(): void {
    this.activeMode = 'none';
  }

  private notifyOpenerAndClosePopup(): void {
    if (!window.opener || window.opener.closed) {
      return;
    }

    window.opener.postMessage({ type: AUTH_SUCCESS_MESSAGE }, window.location.origin);
    window.close();
  }

  private startPopupPolling(): void {
    this.stopPopupPolling();

    this.popupPollTimerId = setInterval(() => {
      if (!this.authPopup || this.authPopup.closed) {
        this.stopPopupPolling();
        this.refreshAuthState();
      }
    }, 400);
  }

  private stopPopupPolling(): void {
    if (this.popupPollTimerId) {
      clearInterval(this.popupPollTimerId);
      this.popupPollTimerId = null;
    }
  }

  private async forceFavicon(): Promise<void> {
    let iconHref = `tabicon-v4.png?v=${Date.now()}`;

    try {
      const response = await fetch(`tabicon-v4.png?v=${Date.now()}`, { cache: 'no-store' });
      if (response.ok) {
        const blob = await response.blob();
        this.faviconObjectUrl = URL.createObjectURL(blob);
        iconHref = this.faviconObjectUrl;
      }
    } catch (error) {
      // Fallback to URL-based favicon if blob loading fails.
    }

    const setIconLink = (selector: string, rel: string): void => {
      let link = document.querySelector<HTMLLinkElement>(selector);
      if (!link) {
        link = document.createElement('link');
        link.rel = rel;
        document.head.appendChild(link);
      }

      link.type = 'image/png';
      link.href = iconHref;
    };

    setIconLink('link[rel="icon"]', 'icon');
    setIconLink('link[rel="shortcut icon"]', 'shortcut icon');
  }
}
