import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, shareReplay, tap, timeout } from 'rxjs';

export type UserRole = 'user' | 'admin' | 'moderation' | 'support';

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  token?: string;
}

export interface LoginRequest {
  login: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  inviteCode: string;
}

export interface PageResponse<T> {
  content: T[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface AccountRow {
  profileId: number;
  login: string;
  email: string;
  paroleHash: string;
  farmed: boolean;
  blocked: boolean;
  hasSteamGuard: boolean;
  earnedTotal: number;
  vmName: string | null;
  lastTimeStarted: string | null;
}

export interface AccountInfo {
  total: number;
  farmed: number;
  needFarm: number;
  blocked: number;
}

export interface LastDropInfo {
  itemCount: number;
  ItemsPrice: number;
  UniqueItems: number;
  lastUpdate: string;
}

export interface UniqueItem {
  itemName: string;
  itemWearAndTear: string | null;
  itemCount: number;
  totalPrice: number;
  avgPrice: number;
}

export interface WeeklyDropItem {
  itemName: string;
  itemWearAndTear: string | null;
  profileLogin: string;
  itemCount: number;
  totalPrice: number;
  avgPrice: number;
}

export interface ItemImageResponse {
  imageUrl: string | null;
}

export interface CreateProfileRequest {
  login: string;
  email: string;
  paroleHash: string;
  farmed?: number;
  blocked?: number;
}

export interface ProfileResponse {
  profileId: number;
  userId: number;
  login: string;
  email: string;
  farmed: boolean;
  blocked: boolean;
}

export interface UpdateAccountRequest {
  login?: string;
  email?: string;
  paroleHash?: string;
  farmed?: boolean;
  blocked?: boolean;
}

export interface StashFarmAccount {
  profileId: number;
  login: string;
  vmName: string | null;
  farmed: boolean;
  blocked: boolean;
}
export interface StashAccountRow {
  profileId: number;
  login: string;
  email: string;
  blocked: boolean;
  hasSteamGuard: boolean;
  linkedAccounts: StashFarmAccount[];
}
export interface StorageSnapshot {
  stashes: StashAccountRow[];
  farmAccounts: StashFarmAccount[];
}
export interface SaveStashRequest {
  login?: string;
  email?: string;
  password?: string;
  blocked: boolean;
  farmProfileIds: number[];
}
export interface MachineApiRow {
  id: number;
  deviceKey: string;
  name: string;
  status: 'online' | 'offline';
  ip: string | null;
  os: string | null;
  cpu: string | null;
  ram: string | null;
  disk: string | null;
  lastSeen: string;
  cpuUsage: number;
  ramUsage: number;
  diskUsage: number;
  hasWarning: boolean;
}

export interface MachineLogApiRow {
  id: number;
  machineId: number;
  machine: string;
  level: 'info' | 'warning' | 'error';
    source?: 'system' | 'panel' | 'farm';
    category?: string | null;
  message: string;
  createdAt: string;
}
export interface VmPanelSummaryRow {
  vmName: string;
  active: boolean;
  profileCount: number;
  profileLogins: string[];
  lastTimeStarted: string | null;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private storageSnapshotCache$?: Observable<StorageSnapshot>;

  private get apiBase() {
    //if (typeof window !== 'undefined' && ['---------', 'www.---------.com'].includes(window.location.hostname)) {
    //  return 'https://-------------';
    //}

    return 'http://localhost:8080';
  }

  constructor(private readonly http: HttpClient) {}

  me() {
    return this.http.get<AuthUser>(`${this.apiBase}/api/auth/me`);
  }

  login(body: LoginRequest) {
    return this.http.post<AuthUser>(`${this.apiBase}/api/auth/login`, body).pipe(timeout(10000));
  }

  register(body: RegisterRequest) {
    return this.http.post<AuthUser>(`${this.apiBase}/api/auth/register`, body).pipe(timeout(10000));
  }

  refresh() {
    return this.http.post<void>(`${this.apiBase}/api/auth/refresh`, {}).pipe(timeout(10000));
  }

  logout() {
    return this.http.post<void>(`${this.apiBase}/api/auth/logout`, {});
  }

  accountInfo() {
    return this.http.get<AccountInfo>(`${this.apiBase}/api/accounts/info`);
  }

  accounts(query = '', page = 0, size = 10) {
    let params = new HttpParams().set('page', page).set('size', size);

    if (query.trim()) {
      params = params.set('login', query.trim());
    }

    return this.http.get<PageResponse<AccountRow>>(`${this.apiBase}/api/accounts`, { params });
  }

  createProfile(body: CreateProfileRequest) {
    return this.http.post<ProfileResponse>(`${this.apiBase}/api/profiles`, body);
  }

  updateAccount(profileId: number, body: UpdateAccountRequest) {
    return this.http.put<{ ok: boolean; profileId: number }>(`${this.apiBase}/api/accounts/${profileId}`, body);
  }

  machines() {
    return this.http.get<MachineApiRow[]>(`${this.apiBase}/api/machines`);
  }

  machineLogs(machineId?: number, source?: 'system' | 'application') {
      let params = new HttpParams();
      if (machineId != null) params = params.set('machineId', machineId);
      if (source) params = params.set('source', source);
      return this.http.get<MachineLogApiRow[]>(`${this.apiBase}/api/machines/logs`, { params });
    }

  deleteMachine(machineId: number) {
    return this.http.delete<{ ok: boolean; machineId: number }>(`${this.apiBase}/api/machines/${machineId}`);
  }
  vmSummary() {
    return this.http.get<VmPanelSummaryRow[]>(`${this.apiBase}/api/vm-panels/summary`);
  }

  assignVm(profileLogin: string, vmName: string) {
    return this.http.post(`${this.apiBase}/api/vm-panels/assign`, { profileLogin, vmName }, { responseType: 'text' });
  }

  unassignVm(profileLogin: string) {
    return this.http.delete(`${this.apiBase}/api/vm-panels/unassign`, {
      params: new HttpParams().set('profileLogin', profileLogin),
      responseType: 'text',
    });
  }

  deleteVm(vmName: string) {
    return this.http.delete<{ ok: boolean; deleted: number }>(`${this.apiBase}/api/vm-panels/by-name`, {
      params: new HttpParams().set('vmName', vmName),
    });
  }

  importSteamGuard(profileLogin: string, mafile: File, tradeToken = '') {
    const form = new FormData();
    form.append('profileLogin', profileLogin);
    form.append('mafile', mafile);
    if (tradeToken.trim()) form.append('tradeToken', tradeToken.trim());
    return this.http.post<{ success: boolean; message: string }>(`${this.apiBase}/api/steamguard/import-by-login`, form).pipe(tap(() => this.invalidateStorageCache()));
  }

  saveSteamTradeToken(profileLogin: string, tradeToken: string) {
    const form = new FormData();
    form.append('profileLogin', profileLogin);
    form.append('tradeToken', tradeToken.trim());
    return this.http.post<{ success: boolean; message: string }>(this.apiBase + '/api/steamguard/trade-token-by-login', form).pipe(tap(() => this.invalidateStorageCache()));
  }

  storageSnapshot(force = false) {
    if (force || !this.storageSnapshotCache$) {
      this.storageSnapshotCache$ = this.http
        .get<StorageSnapshot>(this.apiBase + '/api/stashes/snapshot')
        .pipe(shareReplay({ bufferSize: 1, refCount: false }));
    }
    return this.storageSnapshotCache$;
  }

  preloadStorage() {
    this.storageSnapshot().subscribe({ error: () => this.invalidateStorageCache() });
  }

  invalidateStorageCache() {
    this.storageSnapshotCache$ = undefined;
  }

  stashes() {
    return this.http.get<StashAccountRow[]>(`${this.apiBase}/api/stashes`);
  }

  createStash(body: SaveStashRequest) {
    return this.http.post<StashAccountRow>(`${this.apiBase}/api/stashes`, body).pipe(tap(() => this.invalidateStorageCache()));
  }

  updateStash(stashId: number, body: SaveStashRequest) {
    return this.http.put<StashAccountRow>(`${this.apiBase}/api/stashes/${stashId}`, body).pipe(tap(() => this.invalidateStorageCache()));
  }

  deleteStash(stashId: number) {
    return this.http.delete<{ ok: boolean; released: number }>(`${this.apiBase}/api/stashes/${stashId}`).pipe(tap(() => this.invalidateStorageCache()));
  }

  stashAssignment(farmProfileId: number) {
    return this.http.get<{ stashProfileId: number; stashLogin: string; stashEmail: string }>(`${this.apiBase}/api/stashes/assignment`, { params: { farmProfileId } });
  }
  lastDropInfo() {
    return this.http.get<LastDropInfo>(`${this.apiBase}/api/lastdrop/infopanel`);
  }

  uniqueItems() {
    return this.http.get<UniqueItem[]>(`${this.apiBase}/api/lastdrop/unique-items`);
  }

  weeklyItems() {
    return this.http.get<WeeklyDropItem[]>(`${this.apiBase}/api/lastdrop/weekly-items`);
  }

  itemImage(name: string) {
    return this.http.get<ItemImageResponse>(`${this.apiBase}/api/steam/item-image`, {
      params: new HttpParams().set('name', name),
    });
  }
}

