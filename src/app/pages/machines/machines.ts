import { DOCUMENT } from '@angular/common';
import { ChangeDetectorRef, Component, Inject, OnDestroy, OnInit, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { ApiService, MachineApiRow, MachineLogApiRow } from '../../services/api';

type MachineStatus = 'online' | 'offline';
type LogLevel = 'info' | 'warning' | 'error';
type PaginationItem = number | 'ellipsis-left' | 'ellipsis-right';

interface Machine {
  id: number; name: string; status: MachineStatus; ip: string; os: string; cpu: string; ram: string; disk: string;
  lastSeen: string; cpuUsage: number; ramUsage: number; diskUsage: number; hasWarning: boolean;
}
interface MachineLog {
  id: number; time: string; machine: string; level: LogLevel; source: 'system' | 'panel' | 'farm';
  category: string | null; message: string;
}

@Component({ selector: 'app-machines', imports: [], templateUrl: './machines.html', styleUrl: './machines.css' })
export class Machines implements OnInit, OnDestroy {
  machines: Machine[] = [];
  machineLogs: MachineLog[] = [];
  readonly selectedMachine = signal<Machine | null>(null);
  readonly currentPage = signal(1);
  readonly pageSize = 5;
  readonly logCurrentPage = signal(1);
  readonly logPageSize = 7;
  readonly selectedMachineLogPageSize = 25;
  readonly selectedLogMachine = signal<string | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private readonly handleVisibilityChange = (): void => {
    if (this.document.visibilityState === 'visible') {
      this.showAllLogs();
      this.cdr.detectChanges();
    }
  };

  constructor(
    private readonly api: ApiService,
    private readonly cdr: ChangeDetectorRef,
    @Inject(DOCUMENT) private readonly document: Document,
  ) {}

  ngOnInit(): void {
    this.loadDashboard(true);
    this.refreshTimer = setInterval(() => this.loadDashboard(false), 1_000);
    this.document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    this.document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }

  get totalMachines(): number { return this.machines.length; }
  get onlineMachines(): number { return this.machines.filter(machine => machine.status === 'online').length; }
  get offlineMachines(): number { return this.machines.filter(machine => machine.status === 'offline').length; }
  get warningMachines(): number { return this.machines.filter(machine => machine.hasWarning).length; }
  get totalPages(): number { return Math.max(1, Math.ceil(this.machines.length / this.pageSize)); }
  get pageNumbers(): PaginationItem[] { return this.paginationItems(this.totalPages, this.currentPage()); }
  get paginatedMachines(): Machine[] {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.machines.slice(start, start + this.pageSize);
  }
  get visibleLogs(): MachineLog[] {
    const names = new Set(this.machines.map(machine => machine.name));
    return this.machineLogs.filter(log => names.has(log.machine));
  }
  get displayedLogs(): MachineLog[] {
    const machineName = this.selectedLogMachine();
    return machineName
      ? this.visibleLogs.filter(log => log.machine === machineName && log.source !== 'system').slice(0, 250)
      : this.visibleLogs.filter(log => log.source === 'system');
  }
  get activeLogPageSize(): number { return this.selectedLogMachine() ? this.selectedMachineLogPageSize : this.logPageSize; }
  get logTotalPages(): number { return Math.max(1, Math.ceil(this.displayedLogs.length / this.activeLogPageSize)); }
  get logPageNumbers(): PaginationItem[] { return this.paginationItems(this.logTotalPages, this.logCurrentPage()); }
  get paginatedLogs(): MachineLog[] {
    const start = (this.logCurrentPage() - 1) * this.activeLogPageSize;
    return this.displayedLogs.slice(start, start + this.activeLogPageSize);
  }

  private paginationItems(total: number, current: number): PaginationItem[] {
    if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
    if (current <= 4) return [1, 2, 3, 4, 5, 'ellipsis-right', total];
    if (current >= total - 3) {
      return [1, 'ellipsis-left', total - 4, total - 3, total - 2, total - 1, total];
    }
    return [1, 'ellipsis-left', current - 1, current, current + 1, 'ellipsis-right', total];
  }
  resourceState(usage: number, criticalAt: number): 'normal' | 'warning' | 'critical' {
    if (usage >= criticalAt) return 'critical';
    if (usage >= 70) return 'warning';
    return 'normal';
  }
  selectMachine(machine: Machine): void { this.selectedMachine.set(machine); }
  setPage(page: number): void { this.currentPage.set(Math.min(Math.max(page, 1), this.totalPages)); }
  setLogPage(page: number): void { this.logCurrentPage.set(Math.min(Math.max(page, 1), this.logTotalPages)); }
  showSelectedMachineLogs(): void {
    const machine = this.selectedMachine();
    if (!machine) return;
    this.selectedLogMachine.set(machine.name);
    this.logCurrentPage.set(1);
    this.loadDashboard(false);
  }
  showAllLogs(): void { this.selectedLogMachine.set(null); this.logCurrentPage.set(1); }

  deleteMachine(machineId: number): void {
    this.api.deleteMachine(machineId).subscribe({
      next: () => {
        const deleted = this.machines.find(machine => machine.id === machineId);
        this.machines = this.machines.filter(machine => machine.id !== machineId);
        this.machineLogs = this.machineLogs.filter(log => log.machine !== deleted?.name);
        this.setPage(this.currentPage());
        if (this.selectedLogMachine() === deleted?.name) this.showAllLogs();
        this.setLogPage(this.logCurrentPage());
        if (this.selectedMachine()?.id === machineId) this.selectedMachine.set(this.machines[0] ?? null);
        this.cdr.detectChanges();
      },
    });
  }

  private loadDashboard(initialLoad: boolean): void {
    if (initialLoad) this.loading.set(true);
    this.loadError.set(false);
    const selectedLogMachineId = this.selectedLogMachine() ? this.selectedMachine()?.id : undefined;
    const logSource = this.selectedLogMachine() ? 'application' : 'system';
    forkJoin({ machines: this.api.machines(), logs: this.api.machineLogs(selectedLogMachineId, logSource) }).subscribe({
      next: ({ machines, logs }) => {
        const selectedMachineId = this.selectedMachine()?.id;
        const selectedLogMachine = this.selectedLogMachine();
        this.machines = machines.map(row => this.mapMachine(row));
        this.machineLogs = logs.map(row => this.mapLog(row));
        this.selectedMachine.set(
          this.machines.find(machine => machine.id === selectedMachineId) ?? this.machines[0] ?? null,
        );
        this.setPage(this.currentPage());
        if (selectedLogMachine && !this.machines.some(machine => machine.name === selectedLogMachine)) {
          this.showAllLogs();
        } else {
          this.setLogPage(this.logCurrentPage());
        }
        this.loading.set(false);
        this.cdr.detectChanges();
      },
      error: () => {
        if (initialLoad) {
          this.machines = [];
          this.machineLogs = [];
          this.selectedMachine.set(null);
        }
        this.loading.set(false);
        this.loadError.set(true);
        this.cdr.detectChanges();
      },
    });
  }

  private mapMachine(row: MachineApiRow): Machine {
    return {
      id: row.id, name: row.name, status: row.status, ip: row.ip ?? 'None', os: row.os ?? 'None',
      cpu: row.cpu ?? 'None', ram: row.ram ?? 'None', disk: row.disk ?? 'None', lastSeen: this.formatLastSeen(row.lastSeen),
      cpuUsage: row.status === 'offline' ? 0 : row.cpuUsage,
      ramUsage: row.status === 'offline' ? 0 : row.ramUsage,
      diskUsage: row.status === 'offline' ? 0 : row.diskUsage,
      hasWarning: row.status === 'online' && row.hasWarning,
    };
  }
  private mapLog(row: MachineLogApiRow): MachineLog {
    return {
      id: row.id, time: this.formatTime(row.createdAt), machine: row.machine, level: row.level,
      source: row.source ?? 'system', category: row.category ?? null, message: row.message,
    };
  }
  private formatTime(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).replace(',', '');
  }
  private formatLastSeen(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value || 'None';
    const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    return date.toLocaleDateString();
  }
}
