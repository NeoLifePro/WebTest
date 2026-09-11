import { ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, finalize, map, of, Subscription, timeout } from 'rxjs';
import { ApiService } from '../../services/api';
import { AuthTokenService } from '../../services/auth-token';

@Component({
  selector: 'app-auth',
  imports: [FormsModule],
  templateUrl: './auth.html',
  styleUrl: './auth.css',
})
export class Auth implements OnDestroy {
  isRegisterMode = false;
  errorMessage = '';
  loading = false;
  private loginTimeoutId: number | null = null;
  private loginSubscription: Subscription | null = null;
  private loginRequestId = 0;

  loginForm = {
    login: '',
    password: '',
  };

  registerForm = {
    username: '',
    email: '',
    password: '',
    inviteCode: '',
  };

  constructor(
    private readonly api: ApiService,
    private readonly authToken: AuthTokenService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  showLogin(): void {
    this.isRegisterMode = false;
    this.errorMessage = '';
  }

  showRegister(): void {
    this.isRegisterMode = true;
    this.errorMessage = '';
  }

  submitLogin(): void {
    if (this.loading) {
      return;
    }

    if (!this.loginForm.login.trim() || !this.loginForm.password) {
      this.errorMessage = 'Login and password are required';
      return;
    }

    const requestId = ++this.loginRequestId;

    this.loading = true;
    this.errorMessage = '';
    this.loginSubscription?.unsubscribe();
    this.loginTimeoutId = window.setTimeout(() => {
      if (this.loading && requestId === this.loginRequestId) {
        this.loginSubscription?.unsubscribe();
        this.loading = false;
        this.errorMessage = 'invalid password or username';
      }
    }, 10000);

    this.loginSubscription = this.api.login({
      login: this.loginForm.login.trim(),
      password: this.loginForm.password,
    }).pipe(
      timeout(8000),
      map((user) => ({ ok: true as const, user })),
      catchError((error) => of({ ok: false as const, message: this.loginErrorMessage(error) })),
      finalize(() => {
        if (requestId === this.loginRequestId) {
          this.clearLoginTimeout();
          this.loading = false;
          this.cdr.detectChanges();
        }
      }),
    ).subscribe({
      next: (result) => {
        if (requestId !== this.loginRequestId) {
          return;
        }

        if (!result.ok) {
          this.errorMessage = result.message;
          this.loading = false;
          this.cdr.detectChanges();
          return;
        }

        const user = result.user;

        if (!user.token) {
          this.errorMessage = 'Login response did not include token';
          return;
        }
        this.authToken.setToken(user.token, user);
        this.router.navigateByUrl('/app/items');
      },
    });
  }

  submitRegister(): void {
    if (!this.registerForm.username.trim() || !this.registerForm.email.trim() || !this.registerForm.password) {
      this.errorMessage = 'Login, email and password are required';
      return;
    }

    if (!this.registerForm.inviteCode.trim()) {
      this.errorMessage = 'ключ не верный';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.api.register({
      username: this.registerForm.username.trim(),
      email: this.registerForm.email.trim(),
      password: this.registerForm.password,
      inviteCode: this.registerForm.inviteCode.trim(),
    }).pipe(
      finalize(() => {
        this.loading = false;
        this.cdr.detectChanges();
      }),
    ).subscribe({
      next: (user) => {
        if (!user.token) {
          this.errorMessage = 'Registration response did not include token';
          return;
        }

        this.authToken.setToken(user.token, user);
        this.router.navigateByUrl('/app/items');
      },
      error: (error) => {
        this.errorMessage = this.registerErrorMessage(error);
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  private registerErrorMessage(error: { status?: number; error?: unknown; message?: string }): string {
    if (error?.status === 0) {
      return 'Backend is not reachable or CORS blocked the request';
    }

    const responseMessage = typeof error?.error === 'string' ? error.error.toLowerCase() : '';
    const errorMessage = error?.message?.toLowerCase() || '';

    if (error?.status === 200 || responseMessage.includes('<!doctype html') || errorMessage.includes('http failure during parsing')) {
      return 'API proxy is not configured for this domain';
    }

    if (responseMessage.includes('invalid invite code')) {
      return 'ключ не верный';
    }

    if (error?.status === 409 && responseMessage.includes('username')) {
      return 'логин уже используется';
    }

    if (error?.status === 409 && responseMessage.includes('email')) {
      return 'почта уже используется';
    }

    return `Could not create account (${error?.status || 'unknown'})`;
  }

  private loginErrorMessage(error: { status?: number; error?: unknown; name?: string; message?: string }): string {
    if (error?.status === 0) {
      return 'Backend is not reachable or CORS blocked the request';
    }

    const responseMessage = typeof error?.error === 'string' ? error.error.toLowerCase() : '';
    const errorMessage = error?.message?.toLowerCase() || '';

    if (error?.status === 200 || responseMessage.includes('<!doctype html') || errorMessage.includes('http failure during parsing')) {
      return 'API proxy is not configured for this domain';
    }

    if (responseMessage.includes('ban')) {
      return 'your account is banned';
    }

    if (error?.status === 401) {
      return 'invalid password or username';
    }

    if (error?.status === 403) {
      return 'your account is banned';
    }

    return 'invalid password or username';
  }

  private clearLoginTimeout(): void {
    if (this.loginTimeoutId !== null) {
      window.clearTimeout(this.loginTimeoutId);
      this.loginTimeoutId = null;
    }
  }

  ngOnDestroy(): void {
    this.clearLoginTimeout();
    this.loginSubscription?.unsubscribe();
  }
}
