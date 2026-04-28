import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface ApiResult {
  request: string;
  status?: number;
  ok?: boolean;
  body?: unknown;
  error?: string;
}

@Component({
  selector: 'app-root',
  imports: [FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  backendBaseUrl = this.loadStoredBaseUrl();
  getFreeGames = false;
  ownedGamesLimit = 30;
  rankGamesLimit = 30;
  output = 'Ready.';

  saveBackendBaseUrl(): void {
    localStorage.setItem('wdps_backend_base_url', this.backendBaseUrl.trim());
    this.output = JSON.stringify(
      {
        status: 'ok',
        backendBaseUrl: this.getBaseUrl()
      },
      null,
      2
    );
  }

  loginWithSteam(): void {
    window.location.href = `${this.getBaseUrl()}/auth/steam`;
  }

  logout(): void {
    window.location.href = `${this.getBaseUrl()}/logout`;
  }

  callWhoAmI(): void {
    this.callApi('/');
  }

  callAccount(): void {
    this.callApi('/account');
  }

  callGetUserOwnedGames(): void {
    const params = new URLSearchParams({
      getFreeGames: this.getFreeGames ? 'true' : 'false',
      limit: String(this.ownedGamesLimit)
    });

    this.callApi(`/getUserOwnedGames?${params.toString()}`);
  }

  callRankUserGames(): void {
    const params = new URLSearchParams({
      limit: String(this.rankGamesLimit)
    });

    this.callApi(`/rankUserGames?${params.toString()}`);
  }

  private loadStoredBaseUrl(): string {
    return localStorage.getItem('wdps_backend_base_url') || 'http://localhost:3000';
  }

  private getBaseUrl(): string {
    return this.backendBaseUrl.trim().replace(/\/$/, '');
  }

  private async callApi(path: string): Promise<void> {
    const url = `${this.getBaseUrl()}${path}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include'
      });

      const contentType = response.headers.get('content-type') || '';
      const body = contentType.includes('application/json') ? await response.json() : await response.text();

      const result: ApiResult = {
        request: url,
        status: response.status,
        ok: response.ok,
        body
      };

      this.output = JSON.stringify(result, null, 2);
    } catch (error) {
      const result: ApiResult = {
        request: url,
        error: error instanceof Error ? error.message : String(error)
      };

      this.output = JSON.stringify(result, null, 2);
    }
  }
}
