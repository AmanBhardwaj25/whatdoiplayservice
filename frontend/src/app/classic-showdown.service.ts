import { Injectable } from '@angular/core';

export interface LibraryGame {
  appid: number;
  name: string;
  playtime_forever?: number;
  img_icon_url?: string;
  img_logo_url?: string;
}

interface ApiEnvelope {
  code: number;
  status: string;
  data?: {
    game_count?: number;
    games?: LibraryGame[];
  };
  message?: string;
}

export interface ClassicSession {
  stack: LibraryGame[];
  currentPair: [LibraryGame, LibraryGame] | null;
  champion: LibraryGame | null;
  removedCount: number;
}

@Injectable({ providedIn: 'root' })
export class ClassicShowdownService {
  async initializeFromRankedLibrary(backendBaseUrl: string, limit = 30): Promise<ClassicSession> {
    const baseUrl = backendBaseUrl.trim().replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/rankUserGames?limit=${limit}`, {
      method: 'GET',
      credentials: 'include'
    });

    let body: ApiEnvelope;
    try {
      body = (await response.json()) as ApiEnvelope;
    } catch {
      throw new Error('Could not parse ranked games response');
    }

    if (!response.ok || body.status !== 'success') {
      throw new Error(body.message || `Failed to load ranked games (status ${response.status})`);
    }

    const games = Array.isArray(body.data?.games) ? body.data!.games! : [];
    return this.createInitialSession(games);
  }

  pickWinner(session: ClassicSession, winnerAppId: number): ClassicSession {
    if (!session.currentPair) {
      return session;
    }

    const [left, right] = session.currentPair;
    const loser = winnerAppId === left.appid ? right : left;

    const nextStack = session.stack.filter((game) => game.appid !== loser.appid);
    return this.advanceSession({
      ...session,
      stack: nextStack
    });
  }

  removeCurrentPairAsNotGame(session: ClassicSession): ClassicSession {
    if (!session.currentPair) {
      return session;
    }

    const [left, right] = session.currentPair;
    const idsToRemove = new Set([left.appid, right.appid]);

    const nextStack = session.stack.filter((game) => !idsToRemove.has(game.appid));
    return this.advanceSession({
      ...session,
      stack: nextStack,
      removedCount: session.removedCount + idsToRemove.size
    });
  }

  private createInitialSession(games: LibraryGame[]): ClassicSession {
    const dedupedGames = this.dedupeGames(games);

    if (dedupedGames.length === 0) {
      return {
        stack: [],
        currentPair: null,
        champion: null,
        removedCount: 0
      };
    }

    if (dedupedGames.length === 1) {
      return {
        stack: dedupedGames,
        currentPair: null,
        champion: dedupedGames[0],
        removedCount: 0
      };
    }

    return {
      stack: dedupedGames,
      currentPair: this.pickRandomPair(dedupedGames),
      champion: null,
      removedCount: 0
    };
  }

  private advanceSession(session: ClassicSession): ClassicSession {
    const { stack } = session;

    if (stack.length === 0) {
      return {
        ...session,
        currentPair: null,
        champion: null
      };
    }

    if (stack.length === 1) {
      return {
        ...session,
        currentPair: null,
        champion: stack[0]
      };
    }

    return {
      ...session,
      champion: null,
      currentPair: this.pickRandomPair(stack)
    };
  }

  private pickRandomPair(games: LibraryGame[]): [LibraryGame, LibraryGame] {
    const leftIndex = Math.floor(Math.random() * games.length);
    let rightIndex = Math.floor(Math.random() * games.length);

    while (rightIndex === leftIndex) {
      rightIndex = Math.floor(Math.random() * games.length);
    }

    return [games[leftIndex], games[rightIndex]];
  }

  private dedupeGames(games: LibraryGame[]): LibraryGame[] {
    const seen = new Set<number>();
    const deduped: LibraryGame[] = [];

    for (const game of games) {
      if (typeof game.appid !== 'number' || seen.has(game.appid)) {
        continue;
      }

      seen.add(game.appid);
      deduped.push(game);
    }

    return deduped;
  }
}
