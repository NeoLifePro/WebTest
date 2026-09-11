import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectorRef, Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { switchMap } from 'rxjs';
import { ApiService, AccountRow } from '../../services/api';

type AccountStatus = 'Active' | 'Banned' | 'Farmed';

interface Account {
  profileId: number;
  login: string;
  email: string;
  password: string;
  vm: string;
  level: number;
  xp: number;
  steamGuard: boolean;
  status: AccountStatus;
  launch: string;
  earned: string;
}

@Component({
  selector: 'app-accounts',
  imports: [FormsModule],
  templateUrl: './accounts.html',
  styleUrl: './accounts.css',
})
export class Accounts implements OnInit {
  accounts: Account[] = [];
  filteredAccounts: Account[] = [];
  accountInfo = {
    total: 0,
    farmed: 0,
    needFarm: 0,
    blocked: 0,
  };

  vms: string[] = [];
  filteredVms = [...this.vms];
  vmProfileCounts = new Map<string, number>();

  searchQuery = '';
  vmSearchQuery = '';
  newVmName = '';
  currentPage = 0;
  readonly pageSize = 10;
  totalAccounts = 0;
  totalPages = 0;
  loadingAccounts = false;
  private accountsRequestId = 0;

  notificationVisible = false;
  notificationMessage = '';

  addAccountModalOpen = false;
  steamGuardModalOpen = false;
  editAccountsListModalOpen = false;
  editAccountDataModalOpen = false;
  vmManagementModalOpen = false;
  vmDeleteConfirmOpen = false;

  newVmMenuOpen = false;
  editVmMenuOpen = false;

  selectedSteamGuardAccount = '';
  selectedSteamGuardFile: File | null = null;
  editAccountIndex = -1;
  editAccountProfileId: number | null = null;
  pendingDeleteVm = '';

  newAccount = this.createBlankAccount();
  editAccount = this.createBlankAccount();

  get bannedCount(): number {
    return this.accounts.filter((account) => account.status === 'Banned').length;
  }

  get farmedCount(): number {
    return this.accounts.filter((account) => account.status === 'Farmed').length;
  }

  constructor(
    private readonly api: ApiService,
    private readonly cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private readonly platformId: object,
  ) {}

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    window.setTimeout(() => {
      this.refreshAccountsPage();
      this.cdr.detectChanges();
    });
  }

  handleAccountSearch(value: string): void {
    this.searchQuery = value;
    this.currentPage = 0;
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.loadAccounts();
    this.cdr.detectChanges();
  }

  openAddAccountModal(): void {
    this.newAccount = this.createBlankAccount();
    this.newVmMenuOpen = false;
    this.addAccountModalOpen = true;
  }

  closeAddAccountModal(): void {
    this.addAccountModalOpen = false;
  }

  saveNewAccount(): void {
    const login = this.newAccount.login.trim();
    const email = this.newAccount.email.trim();
    const password = this.newAccount.password.trim();

    if (!login || !email || !password) {
      this.notify('Please fill in all account fields');
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      this.notify('Please enter a valid email address');
      return;
    }

    if (!this.newAccount.vm) {
      this.notify('Please select a Virtual Machine');
      return;
    }

    this.api.createProfile({
      login,
      email,
      paroleHash: password,
      farmed: 0,
      blocked: 0,
    }).pipe(
      switchMap(() => this.api.assignVm(login, this.newAccount.vm)),
    ).subscribe({
      next: () => {
        this.currentPage = 0;
        this.closeAddAccountModal();
        this.refreshAccountsPage();
        this.notify('Account added');
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.notify(this.cleanApiError(error, 'Could not add account'));
      },
    });
  }

  openSteamGuardModal(): void {
    this.selectedSteamGuardAccount = '';
    this.selectedSteamGuardFile = null;
    this.steamGuardModalOpen = true;
  }

  closeSteamGuardModal(): void {
    this.steamGuardModalOpen = false;
  }

  submitSteamGuard(): void {
    if (!this.selectedSteamGuardAccount) {
      this.notify('Select an account first');
      return;
    }

    if (!this.selectedSteamGuardFile) {
      this.notify('Select a maFile first');
      return;
    }

    this.api.importSteamGuard(this.selectedSteamGuardAccount, this.selectedSteamGuardFile).subscribe({
      next: () => {
        this.closeSteamGuardModal();
        this.refreshAccountsPage();
        this.notify('Steam Guard attached');
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.notify(this.cleanApiError(error, 'Could not attach Steam Guard'));
      },
    });
  }

  openEditAccountsListModal(): void {
    this.editAccountsListModalOpen = true;
  }

  closeEditAccountsListModal(): void {
    this.editAccountsListModalOpen = false;
  }

  openEditAccountDataModal(index: number): void {
    this.editAccountIndex = index;
    this.editAccount = { ...this.accounts[index], password: '' };
    this.editAccountProfileId = this.accounts[index]?.profileId ?? null;
    this.editVmMenuOpen = false;
    this.editAccountDataModalOpen = true;
  }

  closeEditAccountDataModal(): void {
    this.editAccountDataModalOpen = false;
  }

  saveAccountDataEdit(): void {
    if (this.editAccountIndex < 0 || !this.accounts[this.editAccountIndex] || this.editAccountProfileId === null) {
      return;
    }

    const current = this.accounts[this.editAccountIndex];
    const login = this.editAccount.login.trim() || current.login;
    const email = this.editAccount.email.trim();

    if (!email) {
      this.notify('Email is required');
      return;
    }

    const update$ = this.api.updateAccount(this.editAccountProfileId, {
      login,
      email,
      paroleHash: this.editAccount.password || current.password,
    });

    const vm$ = this.editAccount.vm
      ? this.api.assignVm(login, this.editAccount.vm)
      : this.api.unassignVm(login);

    update$.pipe(
      switchMap(() => vm$),
    ).subscribe({
      next: () => {
        this.closeEditAccountDataModal();
        this.closeEditAccountsListModal();
        this.refreshAccountsPage();
        this.notify('Account updated');
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.notify(this.cleanApiError(error, 'Could not update account'));
      },
    });
  }

  openVmManagementModal(): void {
    this.vmManagementModalOpen = true;
    this.applyVmFilter();
  }

  closeVmManagementModal(): void {
    this.vmManagementModalOpen = false;
    this.closeVmDeleteConfirm();
  }

  handleVmSearch(value: string): void {
    this.vmSearchQuery = value;
    this.applyVmFilter();
  }

  addVMModal(): void {
    const vmName = this.newVmName.trim();

    if (!vmName) {
      this.notify('VM name is required');
      return;
    }

    if (this.vms.includes(vmName)) {
      this.notify('VM already exists');
      return;
    }

    this.vms = [...this.vms, vmName].sort((a, b) => a.localeCompare(b));
    this.newVmName = '';
    this.applyVmFilter();
    this.notify('VM added. Assign an account to save it in database.');
  }

  openVmDeleteConfirm(vm: string): void {
    this.pendingDeleteVm = vm;
    this.vmDeleteConfirmOpen = true;
  }

  closeVmDeleteConfirm(): void {
    this.pendingDeleteVm = '';
    this.vmDeleteConfirmOpen = false;
  }

  confirmVmDelete(): void {
    if (!this.pendingDeleteVm) {
      return;
    }

    const vm = this.pendingDeleteVm;
    const affectedCount = this.vmAccountCount(vm);

    this.api.deleteVm(vm).subscribe({
      next: (response) => {
        this.vms = this.vms.filter((item) => item !== vm);
        this.applyVmFilter();
        this.closeVmDeleteConfirm();
        this.refreshAccountsPage();
        const deleted = response.deleted || affectedCount;
        this.notify(deleted > 0 ? `VM deleted. ${deleted} accounts unassigned` : 'VM deleted');
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.notify(this.cleanApiError(error, 'Could not delete VM'));
      },
    });
  }

  selectNewAccountVm(vm: string): void {
    this.newAccount.vm = vm;
    this.newVmMenuOpen = false;
  }

  selectEditAccountVm(vm: string): void {
    this.editAccount.vm = vm;
    this.editVmMenuOpen = false;
  }

  notify(message: string): void {
    this.notificationMessage = message;
    this.notificationVisible = true;

    window.setTimeout(() => {
      this.notificationVisible = false;
    }, 2400);
  }

  closeNotification(): void {
    this.notificationVisible = false;
  }

  vmAccountCount(vm: string): number {
    return this.vmProfileCounts.get(vm) ?? this.accounts.filter((account) => account.vm === vm).length;
  }

  vmAccounts(vm: string): Account[] {
    return this.accounts.filter((account) => account.vm === vm);
  }

  handleSteamGuardFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedSteamGuardFile = input.files?.[0] ?? null;
  }

  goToPreviousPage(): void {
    if (this.currentPage <= 0) {
      return;
    }

    this.currentPage -= 1;
    this.loadAccounts();
    this.cdr.detectChanges();
  }

  goToNextPage(): void {
    if (this.currentPage + 1 >= this.totalPages) {
      return;
    }

    this.currentPage += 1;
    this.loadAccounts();
    this.cdr.detectChanges();
  }

  private applyAccountFilter(): void {
    this.filteredAccounts = [...this.accounts];
  }

  private loadAccounts(): void {
    const requestId = ++this.accountsRequestId;
    this.loadingAccounts = true;
    this.api.accounts(this.searchQuery, this.currentPage, this.pageSize).subscribe({
      next: (response) => {
        if (requestId !== this.accountsRequestId) {
          return;
        }

        this.accounts = response.content.map((row) => this.mapAccount(row));
        this.filteredAccounts = [...this.accounts];
        this.currentPage = response.number;
        this.totalAccounts = response.totalElements;
        this.totalPages = response.totalPages;
        this.loadingAccounts = false;
        this.cdr.detectChanges();
      },
      error: () => {
        if (requestId !== this.accountsRequestId) {
          return;
        }

        this.accounts = [];
        this.filteredAccounts = [];
        this.totalAccounts = 0;
        this.totalPages = 0;
        this.loadingAccounts = false;
        this.cdr.detectChanges();
      },
    });
  }

  private loadAccountInfo(): void {
    this.api.accountInfo().subscribe({
      next: (info) => {
        this.accountInfo = info;
        this.cdr.detectChanges();
      },
    });
  }

  private mapAccount(row: AccountRow): Account {
    return {
      profileId: row.profileId,
      login: row.login,
      email: row.email,
      password: row.paroleHash,
      vm: row.vmName || '',
      level: 0,
      xp: 0,
      steamGuard: row.hasSteamGuard,
      status: row.blocked ? 'Banned' : row.farmed ? 'Farmed' : 'Active',
      launch: row.lastTimeStarted || '-',
      earned: this.formatEarned(row.earnedTotal),
    };
  }

  private applyVmFilter(): void {
    const query = this.vmSearchQuery.trim().toLowerCase();
    this.filteredVms = query ? this.vms.filter((vm) => vm.toLowerCase().includes(query)) : [...this.vms];
  }

  private loadVms(): void {
    this.api.vmSummary().subscribe({
      next: (rows) => {
        this.vmProfileCounts = new Map(rows.map((row) => [row.vmName, row.profileCount]));
        this.vms = rows.map((row) => row.vmName).sort((a, b) => a.localeCompare(b));
        this.applyVmFilter();
        this.cdr.detectChanges();
      },
      error: () => {
        this.vmProfileCounts = new Map();
        this.vms = [];
        this.applyVmFilter();
        this.cdr.detectChanges();
      },
    });
  }

  private refreshAccountsPage(): void {
    this.loadAccounts();
    this.loadAccountInfo();
    this.loadVms();
  }

  private cleanApiError(error: { error?: unknown; message?: string }, fallback: string): string {
    if (typeof error?.error === 'string' && error.error.trim()) {
      return error.error;
    }

    return error?.message || fallback;
  }

  private formatEarned(value: number | null | undefined): string {
    return `${Number(value || 0).toFixed(2)} EUR`;
  }

  private createBlankAccount(): Account {
    return {
      profileId: 0,
      login: '',
      email: '',
      password: '',
      vm: '',
      level: 0,
      xp: 0,
      steamGuard: false,
      status: 'Active',
      launch: '-',
      earned: '$0',
    };
  }
}
