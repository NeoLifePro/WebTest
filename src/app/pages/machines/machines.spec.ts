import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiService, MachineApiRow, MachineLogApiRow } from '../../services/api';
import { Machines } from './machines';

const machineRows: MachineApiRow[] = Array.from({ length: 7 }, (_, index) => ({
  id: index + 1, deviceKey: `device-${index + 1}`, name: `NXP-FARM-0${index + 1}`,
  status: index === 2 ? 'offline' : 'online', ip: `192.168.1.10${index + 1}`, os: 'Windows 11 Pro',
  cpu: 'Intel Core i7', ram: '32 GB', disk: '1 TB', lastSeen: new Date().toISOString(),
  cpuUsage: 40 + index, ramUsage: 50 + index, diskUsage: 60 + index, hasWarning: index === 1,
}));
const logRows: MachineLogApiRow[] = Array.from({ length: 11 }, (_, index) => ({
  id: index + 1, machineId: (index % 7) + 1, machine: `NXP-FARM-0${(index % 7) + 1}`,
  level: index % 3 === 0 ? 'warning' : 'info', message: `Log ${index + 1}`, createdAt: new Date().toISOString(),
}));

class ApiStub {
  machines = () => of(machineRows);
  machineLogs = () => of(logRows);
  deleteMachine = (machineId: number) => of({ ok: true, machineId });
}

describe('Machines', () => {
  let component: Machines;
  let fixture: ComponentFixture<Machines>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Machines],
      providers: [{ provide: ApiService, useClass: ApiStub }],
    }).compileComponents();
    fixture = TestBed.createComponent(Machines);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('loads devices and selects the first machine', () => {
    expect(component.machines.length).toBe(7);
    expect(component.selectedMachine()).toBe(component.machines[0]);
  });

  it('updates the overview when another machine row is clicked', () => {
    const rows = fixture.nativeElement.querySelectorAll('.machine-row');
    rows[1].click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.machine-name').textContent).toContain('NXP-FARM-02');
  });

  it('paginates machines by five and all logs by seven', () => {
    expect(component.paginatedMachines.length).toBe(5);
    expect(component.totalPages).toBe(2);
    component.setPage(2);
    expect(component.paginatedMachines.length).toBe(2);
    expect(component.paginatedLogs.length).toBe(7);
    expect(component.logTotalPages).toBe(2);
  });

  it('shows selected machine logs and returns to all logs', () => {
    component.showSelectedMachineLogs();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.machines-table-content')).toBeNull();
    expect(component.selectedLogMachine()).toBe('NXP-FARM-01');
    expect(component.activeLogPageSize).toBe(25);
    expect(component.displayedLogs.every(log => log.machine === 'NXP-FARM-01')).toBe(true);
    component.showAllLogs();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.machines-table-content')).not.toBeNull();
    expect(component.activeLogPageSize).toBe(7);
  });

  it('deletes a machine through the API and selects the next one', () => {
    const deleteButton = fixture.nativeElement.querySelector('.table-delete-button') as HTMLButtonElement;
    deleteButton.click();
    fixture.detectChanges();
    expect(component.machines.length).toBe(6);
    expect(component.selectedMachine()?.name).toBe('NXP-FARM-02');
  });

  it('shows None when there are no machines', () => {
    component.machines = [];
    component.selectedMachine.set(null);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.machine-name').textContent).toContain('None');
    expect(component.totalMachines).toBe(0);
  });
});
