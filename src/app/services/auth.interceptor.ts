import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthTokenService } from './auth-token';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const authToken = inject(AuthTokenService);
  const router = inject(Router);
  const token = authToken.getToken();
  if (!token) return next(request);

  return next(request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })).pipe(
    catchError((error) => {
      if (error.status === 401 && authToken.getToken() === token &&
          !/\/api\/auth\/(login|register)$/.test(request.url)) {
        authToken.clearToken();
        void router.navigateByUrl('/auth');
      }
      return throwError(() => error);
    }),
  );
};
