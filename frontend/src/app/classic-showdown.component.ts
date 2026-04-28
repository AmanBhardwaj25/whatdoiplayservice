import { Component, Input, OnInit } from '@angular/core';
import { ClassicSession, ClassicShowdownService, LibraryGame } from './classic-showdown.service';

@Component({
  selector: 'app-classic-showdown',
  templateUrl: './classic-showdown.component.html',
  styleUrl: './classic-showdown.component.css'
})
export class ClassicShowdownComponent implements OnInit {
  @Input({ required: true }) backendBaseUrl = '';

  isLoading = true;
  errorMessage = '';
  session: ClassicSession | null = null;
  private readonly artworkFallbackIndex = new Map<number, number>();

  constructor(private classicShowdownService: ClassicShowdownService) {}

  ngOnInit(): void {
    this.initializeClassicMode();
  }

  async initializeClassicMode(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      this.session = await this.classicShowdownService.initializeFromRankedLibrary(this.backendBaseUrl, 30);
      this.resetPairArtworkState();
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Failed to initialize classic mode';
      this.session = null;
    } finally {
      this.isLoading = false;
    }
  }

  pickWinner(game: LibraryGame): void {
    if (!this.session) {
      return;
    }

    this.session = this.classicShowdownService.pickWinner(this.session, game.appid);
    this.resetPairArtworkState();
  }

  removePairAsNotGame(): void {
    if (!this.session) {
      return;
    }

    this.session = this.classicShowdownService.removeCurrentPairAsNotGame(this.session);
    this.resetPairArtworkState();
  }

  hasPair(): boolean {
    return Boolean(this.session?.currentPair);
  }

  getHoursPlayed(game: LibraryGame): string {
    const minutes = game.playtime_forever || 0;
    const hours = minutes / 60;
    return `${hours.toFixed(1)} hrs played`;
  }

  getArtworkSrc(game: LibraryGame): string {
    const sources = this.getArtworkSources(game);
    const index = this.artworkFallbackIndex.get(game.appid) ?? 0;
    return sources[Math.min(index, sources.length - 1)];
  }

  onArtworkError(game: LibraryGame): void {
    const sources = this.getArtworkSources(game);
    const currentIndex = this.artworkFallbackIndex.get(game.appid) ?? 0;
    if (currentIndex < sources.length - 1) {
      this.artworkFallbackIndex.set(game.appid, currentIndex + 1);
    }
  }

  private getArtworkSources(game: LibraryGame): string[] {
    const appId = game.appid;
    const sources: string[] = [
      `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/capsule_616x353.jpg`,
      `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`,
      `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_hero.jpg`,
      `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_600x900_2x.jpg`
    ];

    if (game.img_logo_url) {
      sources.push(
        `https://media.steampowered.com/steamcommunity/public/images/apps/${appId}/${game.img_logo_url}.jpg`
      );
    }

    if (game.img_icon_url) {
      sources.push(
        `https://media.steampowered.com/steamcommunity/public/images/apps/${appId}/${game.img_icon_url}.jpg`
      );
    }

    return sources;
  }

  private resetPairArtworkState(): void {
    if (!this.session?.currentPair) {
      this.artworkFallbackIndex.clear();
      return;
    }

    const activeIds = new Set(this.session.currentPair.map((game) => game.appid));
    for (const key of this.artworkFallbackIndex.keys()) {
      if (!activeIds.has(key)) {
        this.artworkFallbackIndex.delete(key);
      }
    }
  }
}
