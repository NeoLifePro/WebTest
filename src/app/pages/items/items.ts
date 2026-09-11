import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectorRef, Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { ApiService, WeeklyDropItem } from '../../services/api';

interface DroppedItem {
  name: string;
  owner: string;
  count: number;
  price: number;
  totalPrice: number;
  rarity: string;
  imageUrl: string | null;
}

type SortField = 'name' | 'owner' | 'count' | 'price' | 'total' | 'rarity';
type SortDirection = 'asc' | 'desc';

@Component({
  selector: 'app-items',
  imports: [],
  templateUrl: './items.html',
  styleUrl: './items.css',
})
export class Items implements OnInit {
  readonly placeholderImageUrl = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80">
      <rect width="80" height="80" rx="14" fill="#08162b"/>
      <text x="50%" y="54%" text-anchor="middle" fill="#6f96c5" font-size="10" font-family="Arial">ITEM</text>
    </svg>
  `);

  sortMenuOpen = false;
  selectedSort = 'Value (High to Low)';
  selectedSortValue = 'value_desc';
  sortField: SortField = 'total';
  sortDirection: SortDirection = 'desc';
  viewMode: 'all' | 'profile' = 'all';
  searchQuery = '';
  readonly pageSize = 10;
  currentPage = 1;
  loading = false;

  items: DroppedItem[] = [];
  private readonly imageCache = new Map<string, string | null>();
  private readonly pendingImageRequests = new Set<string>();

  readonly sortOptions = [
    { label: 'Count (High to Low)', value: 'count_desc' },
    { label: 'Count (Low to High)', value: 'count_asc' },
    { label: 'Name (A-Z)', value: 'name_asc' },
    { label: 'Name (Z-A)', value: 'name_desc' },
    { label: 'Price (High to Low)', value: 'price_desc' },
    { label: 'Price (Low to High)', value: 'price_asc' },
    { label: 'Value (High to Low)', value: 'value_desc' },
    { label: 'Value (Low to High)', value: 'value_asc' },
    { label: 'Rarity (A-Z)', value: 'rarity_asc' },
  ];

  constructor(
    private readonly api: ApiService,
    private readonly cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private readonly platformId: object,
  ) {}

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    window.setTimeout(() => this.loadWeeklyDrop());
  }

  get selectedPage(): string {
    return this.viewMode === 'profile' ? 'All items' : 'Profile item';
  }

  get searchPlaceholder(): string {
    return this.viewMode === 'profile' ? 'Search profile...' : 'Search items...';
  }

  get filteredItems(): DroppedItem[] {
    const query = this.searchQuery.trim().toLowerCase();
    const source = this.viewMode === 'all' ? this.aggregateAllItems() : this.items;
    const filtered = query
      ? source.filter((item) => {
          const target = this.viewMode === 'profile' ? item.owner : item.name;
          return target.toLowerCase().includes(query);
        })
      : [...source];

    return this.sortItems(filtered);
  }

  get totalRows(): number {
    return this.filteredItems.length;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalRows / this.pageSize));
  }

  get pagedItems(): DroppedItem[] {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    return this.filteredItems.slice(startIndex, startIndex + this.pageSize);
  }

  get pageStart(): number {
    return this.totalRows === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
  }

  get pageEnd(): number {
    return Math.min(this.currentPage * this.pageSize, this.totalRows);
  }

  get totalItems(): number {
    return this.filteredItems.reduce((sum, item) => sum + item.count, 0);
  }

  get totalValue(): number {
    return this.filteredItems.reduce((sum, item) => sum + item.totalPrice, 0);
  }

  get uniqueItems(): number {
    return new Set(this.filteredItems.map((item) => item.name)).size;
  }

  togglePage(): void {
    this.viewMode = this.viewMode === 'profile' ? 'all' : 'profile';
    this.searchQuery = '';
    this.currentPage = 1;
  }

  updateSearch(value: string): void {
    this.searchQuery = value;
    this.currentPage = 1;
  }

  toggleSortMenu(): void {
    this.sortMenuOpen = !this.sortMenuOpen;
  }

  selectSort(label: string, value: string): void {
    this.selectedSort = label;
    this.selectedSortValue = value;
    const parsed = this.parseSortValue(value);
    this.sortField = parsed.field;
    this.sortDirection = parsed.direction;
    this.sortMenuOpen = false;
    this.currentPage = 1;
  }

  sortBy(field: SortField): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = field === 'name' || field === 'owner' || field === 'rarity' ? 'asc' : 'desc';
    }

    this.selectedSortValue = this.sortValueFromState();
    this.selectedSort = this.sortLabelFromState();
    this.sortMenuOpen = false;
    this.currentPage = 1;
  }

  sortIcon(field: SortField): string {
    if (this.sortField !== field) {
      return 'ph ph-caret-up-down';
    }

    return this.sortDirection === 'asc' ? 'ph ph-caret-up' : 'ph ph-caret-down';
  }

  previousPage(): void {
    this.goToPage(this.currentPage - 1);
  }

  nextPage(): void {
    this.goToPage(this.currentPage + 1);
  }

  goToPage(page: number): void {
    this.currentPage = Math.min(Math.max(page, 1), this.totalPages);
  }

  itemTotal(item: DroppedItem): number {
    return item.totalPrice;
  }

  marketUrl(item: DroppedItem): string {
    return `https://steamcommunity.com/market/listings/730/${encodeURIComponent(item.name)}`;
  }

  private loadWeeklyDrop(): void {
    this.loading = true;

    this.api.weeklyItems().subscribe({
      next: (items) => {
        this.items = items.map((item) => this.mapWeeklyItem(item));
        this.currentPage = 1;
        this.loading = false;
        this.cdr.detectChanges();
        this.loadImagesForCurrentItems();
      },
      error: () => {
        this.items = [];
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  private mapWeeklyItem(item: WeeklyDropItem): DroppedItem {
    const itemName = item.itemName || 'Unknown item';
    const wear = item.itemWearAndTear || '';
    const lowerName = itemName.toLowerCase();
    const lowerWear = wear.toLowerCase();

    let displayName = itemName;
    let rarity = wear || 'Drop';

    if (lowerName.includes('case') || lowerName.includes('terminal') || lowerWear === 'case') {
      rarity = 'Case';
    } else if (wear && !itemName.includes('(')) {
      displayName = `${itemName} (${wear})`;
    }

    return {
      name: displayName,
      owner: item.profileLogin || '-',
      count: item.itemCount,
      price: item.avgPrice || 0,
      totalPrice: item.totalPrice || 0,
      rarity,
      imageUrl: null,
    };
  }

  private loadImagesForCurrentItems(): void {
    const uniqueNames = Array.from(new Set(this.items.map((item) => item.name)));

    for (const name of uniqueNames) {
      if (this.imageCache.has(name) || this.pendingImageRequests.has(name)) {
        continue;
      }

      this.pendingImageRequests.add(name);
      this.api.itemImage(name).subscribe({
        next: (response) => {
          this.pendingImageRequests.delete(name);
          this.imageCache.set(name, response.imageUrl);
          this.items = this.items.map((row) => row.name === name ? { ...row, imageUrl: response.imageUrl } : row);
          this.cdr.detectChanges();
        },
        error: () => {
          this.pendingImageRequests.delete(name);
          this.imageCache.set(name, null);
        },
      });
    }
  }

  private aggregateAllItems(): DroppedItem[] {
    const grouped = new Map<string, DroppedItem>();

    for (const item of this.items) {
      const key = `${item.name}::${item.rarity}`;
      const existing = grouped.get(key);

      if (!existing) {
        grouped.set(key, {
          ...item,
          owner: '',
          imageUrl: this.imageCache.get(item.name) ?? item.imageUrl,
        });
        continue;
      }

      const count = existing.count + item.count;
      const totalPrice = existing.totalPrice + item.totalPrice;
      grouped.set(key, {
        ...existing,
        count,
        totalPrice,
        price: count > 0 ? totalPrice / count : 0,
        imageUrl: this.imageCache.get(item.name) ?? existing.imageUrl,
      });
    }

    return Array.from(grouped.values());
  }

  private sortItems(items: DroppedItem[]): DroppedItem[] {
    return [...items].sort((a, b) => {
      let result = 0;

      switch (this.sortField) {
        case 'name':
          result = a.name.localeCompare(b.name);
          break;
        case 'owner':
          result = a.owner.localeCompare(b.owner);
          break;
        case 'price':
          result = a.price - b.price;
          break;
        case 'total':
          result = a.totalPrice - b.totalPrice;
          break;
        case 'rarity':
          result = a.rarity.localeCompare(b.rarity);
          break;
        case 'count':
        default:
          result = a.count - b.count;
          break;
      }

      return this.sortDirection === 'asc' ? result : -result;
    });
  }

  private parseSortValue(value: string): { field: SortField; direction: SortDirection } {
    const [fieldValue, directionValue] = value.split('_');
    const direction: SortDirection = directionValue === 'asc' ? 'asc' : 'desc';

    if (fieldValue === 'value') {
      return { field: 'total', direction };
    }

    if (fieldValue === 'owner' || fieldValue === 'price' || fieldValue === 'rarity' || fieldValue === 'name' || fieldValue === 'count') {
      return { field: fieldValue, direction };
    }

    return { field: 'count', direction: 'desc' };
  }

  private sortValueFromState(): string {
    const field = this.sortField === 'total' ? 'value' : this.sortField;
    return `${field}_${this.sortDirection}`;
  }

  private sortLabelFromState(): string {
    const directionLabel = this.sortDirection === 'asc' ? 'Low to High' : 'High to Low';

    switch (this.sortField) {
      case 'name':
        return this.sortDirection === 'asc' ? 'Name (A-Z)' : 'Name (Z-A)';
      case 'owner':
        return this.sortDirection === 'asc' ? 'Profile (A-Z)' : 'Profile (Z-A)';
      case 'price':
        return `Price (${directionLabel})`;
      case 'total':
        return `Value (${directionLabel})`;
      case 'rarity':
        return this.sortDirection === 'asc' ? 'Rarity (A-Z)' : 'Rarity (Z-A)';
      case 'count':
      default:
        return `Count (${directionLabel})`;
    }
  }
}
