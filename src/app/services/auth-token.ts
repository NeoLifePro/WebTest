import { isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import type { AuthUser, UserRole } from './api';

@Injectable({ providedIn: 'root' })
export class AuthTokenService {
  private readonly key = 'nxpanel_token';
  private readonly userKey = 'nxpanel_user';

  constructor(@Inject(PLATFORM_ID) private readonly platformId: object) {}

  getToken(): string | null {
    return isPlatformBrowser(this.platformId) ? window.localStorage.getItem(this.key) : null;
  }

  setToken(token: string, user: AuthUser): void {
    if (isPlatformBrowser(this.platformId)) {
      window.localStorage.setItem(this.key, token);
      window.localStorage.setItem(this.userKey, JSON.stringify({ name: user.username, role: user.role }));
    }
  }

  clearToken(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.localStorage.removeItem(this.key);
      window.localStorage.removeItem(this.userKey);
    }
  }


  getTokenUser(): { name: string; role: UserRole } | null {
    if (!this.getToken()) return null;
    try {
      return JSON.parse(window.localStorage.getItem(this.userKey) || 'null');
    } catch {
      this.clearToken();
      return null;
    }
  }
}
