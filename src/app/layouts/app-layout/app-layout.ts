import { Component, Inject, PLATFORM_ID, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Router } from '@angular/router';
import { ApiService, UserRole } from '../../services/api';
import { AuthTokenService } from '../../services/auth-token';

@Component({
  selector: 'app-app-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app-layout.html',
  styleUrl: './app-layout.css'
})
export class AppLayout implements OnDestroy {
  private refreshTimer?: number;
  private refreshRequest?: Subscription;
  private meRequest?: Subscription;
  private readonly onVisibilityChange = () => this.refreshSession();

  activeUser: { name: string; role: UserRole } | null = null;

  constructor(
    private readonly api: ApiService,
    private readonly authToken: AuthTokenService,
    private readonly router: Router,
    @Inject(PLATFORM_ID) private readonly platformId: object,
  ) {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const tokenUser = this.authToken.getTokenUser();

    if (!tokenUser) {
      this.router.navigateByUrl('/auth');
      return;
    }

    this.activeUser = tokenUser;
    this.refreshTimer = window.setInterval(() => this.refreshSession(), 60000);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.refreshSession();

    // Start loading Storage while the user is still on another dashboard page.
    this.api.preloadStorage();

    const token = this.authToken.getToken();
    this.meRequest = this.api.me().subscribe({
      next: (user) => {
        if (this.authToken.getToken() !== token) return;
        this.activeUser = {
          name: user.username,
          role: user.role,
        };
      },
      error: (error) => this.handleSessionError(error, token),
    });
  }

  private refreshSession(): void {
    if (document.visibilityState !== 'visible' || (this.refreshRequest && !this.refreshRequest.closed)) return;
    if (!this.authToken.getToken()) {
      this.router.navigateByUrl('/auth');
      return;
    }
    const token = this.authToken.getToken();
    this.refreshRequest = this.api.refresh().subscribe({
      error: (error) => this.handleSessionError(error, token),
    });
  }

  private handleSessionError(error: { status?: number }, token: string | null): void {
    // Network errors and server failures do not mean the session is invalid.
    // A late response from an old session must not clear a newer login.
    if ((error.status === 401 || error.status === 403) &&
        token !== null && this.authToken.getToken() === token) {
      this.authToken.clearToken();
      this.api.invalidateStorageCache();
      void this.router.navigateByUrl('/auth');
    }
  }

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.clearInterval(this.refreshTimer);
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }
    this.refreshRequest?.unsubscribe();
    this.meRequest?.unsubscribe();
  }

  logout(): void {
    this.refreshRequest?.unsubscribe();
    this.meRequest?.unsubscribe();
    this.api.logout().subscribe({ error: () => {} });
    this.api.invalidateStorageCache();
    this.authToken.clearToken();
    this.router.navigateByUrl('/auth');
  }
}
