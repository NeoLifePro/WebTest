import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { Router } from '@angular/router';
import { UserRole } from '../../services/api';
import { AuthTokenService } from '../../services/auth-token';


@Component({
  selector: 'app-public-layout',
  imports: [RouterLink, RouterOutlet],
  templateUrl: './public-layout.html',
  styleUrl: './public-layout.css',
})
export class PublicLayout {
  activeUser: { name: string; role: UserRole } | null = null;

  constructor(
    private readonly authToken: AuthTokenService,
    private readonly router: Router,
  ) {
    this.activeUser = this.authToken.getTokenUser();
  }

  get isLoggedIn(): boolean {
    return this.activeUser !== null;
  }

  logout(): void {
    this.authToken.clearToken();
    this.activeUser = null;
    this.router.navigateByUrl('/home');
  }
}
