import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Subject } from 'rxjs';
import { Router } from '@angular/router';
import { ApiService, AuthUser } from '../../services/api';
import { AuthTokenService } from '../../services/auth-token';
import { AppLayout } from './app-layout';

describe('AppLayout session', () => {
  let layout: AppLayout;
  let me: Subject<AuthUser>;
  let refresh: Subject<void>;
  let token: string;
  let clearToken: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    me = new Subject<AuthUser>();
    refresh = new Subject<void>();
    token = 'current-token';
    clearToken = vi.fn(() => { token = ''; });
    navigate = vi.fn();
    layout = new AppLayout(
      { me: () => me, refresh: () => refresh, preloadStorage: vi.fn(), invalidateStorageCache: vi.fn() } as unknown as ApiService,
      { getToken: () => token, getTokenUser: () => ({ name: 'user', role: 'user' }), clearToken } as unknown as AuthTokenService,
      { navigateByUrl: navigate } as unknown as Router,
      'browser' as unknown as object,
    );
  });

  afterEach(() => {
    layout.ngOnDestroy();
    vi.useRealTimers();
  });

  it.each([0, 500, 502, 503])('keeps the token when /me fails with %s', (status) => {
    me.error({ status });
    expect(clearToken).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it.each([401, 403])('clears an invalid session on %s', (status) => {
    me.error({ status });
    expect(clearToken).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith('/auth');
  });

  it('ignores errors from an earlier login', () => {
    token = 'new-token';
    me.error({ status: 401 });
    refresh.error({ status: 401 });
    expect(clearToken).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('cancels pending checks when the layout is destroyed', () => {
    layout.ngOnDestroy();
    expect(me.observed).toBe(false);
    expect(refresh.observed).toBe(false);
    me.error({ status: 0 });
    expect(clearToken).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps the session on a temporary refresh failure', () => {
    refresh.error({ status: 503 });
    expect(clearToken).not.toHaveBeenCalled();
  });
});
