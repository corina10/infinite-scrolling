import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Comment } from '../models/comment.model';
import { MockCommentService } from './mock-comment.service';

const LOOKAHEAD_BUFFER = 15;
const MEMORY_WINDOW_HALF = 30;

export class CommentDataProvider {
  // WS messages prepended at the top — kept fully in memory, never evicted.
  private _newItems: Comment[] = [];

  // Sparse map of index → Comment for paged data. Only the scroll window is
  // retained in memory; items outside it are deleted and restored from
  // _pageCache when scrolled back into view.
  private _pagedData = new Map<number, Comment>();
  private _totalPagedCount = 0;

  private _inMemoryCount = 0;

  private readonly _data$ = new Subject<(Comment | null)[]>();
  private readonly _loading$ = new Subject<boolean>();
  private readonly _inMemoryCount$ = new Subject<number>();
  private readonly _destroy$ = new Subject<void>();

  private _isLoading = false;
  private readonly _pageCache = new Map<number, Comment[]>();
  private _nextPage = 0;
  private _hasMore = true;

  readonly comments$: Observable<(Comment | null)[]> = this._data$.asObservable();
  readonly loading$: Observable<boolean> = this._loading$.asObservable();
  readonly inMemoryCount$: Observable<number> = this._inMemoryCount$.asObservable();

  get totalFetched(): number {
    return this._newItems.length + this._totalPagedCount;
  }

  constructor(private readonly service: MockCommentService) {
    this._fetchNextPage();
  }

  prependMessage(comment: Comment): void {
    this._newItems = [comment, ...this._newItems];
    this._emitData();
  }

  onScrolled(firstVisible: number, lastVisible: number): void {
    // Translate absolute indices into _pagedData-relative indices by subtracting
    // the number of WS items sitting above the paged section.
    const offset = this._newItems.length;
    const pagedFirst = Math.max(0, firstVisible - offset);
    const pagedLast = lastVisible - offset;

    this._evictAndRestore(pagedFirst);

    if (pagedLast >= this._totalPagedCount - LOOKAHEAD_BUFFER) {
      this._fetchNextPage();
    }
  }

  destroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
    this._data$.complete();
    this._loading$.complete();
    this._inMemoryCount$.complete();
  }

  private _evictAndRestore(firstVisible: number): void {
    const pageSize = this.service.pageSize;
    const windowStart = Math.max(0, firstVisible - MEMORY_WINDOW_HALF);
    const windowEnd = Math.min(this._totalPagedCount - 1, firstVisible + MEMORY_WINDOW_HALF);

    let changed = false;

    for (const i of this._pagedData.keys()) {
      if (i < windowStart || i > windowEnd) {
        this._pagedData.delete(i);
        changed = true;
      }
    }

    const startPage = Math.floor(windowStart / pageSize);
    const endPage = Math.floor(windowEnd / pageSize);

    for (const page of this._pageCache.keys()) {
      if (page < startPage || page > endPage) {
        this._pageCache.delete(page);
      }
    }

    for (let page = startPage; page <= endPage; page++) {
      const cached = this._pageCache.get(page);
      if (!cached) continue;

      const pageStart = page * pageSize;
      for (let i = 0; i < cached.length; i++) {
        const idx = pageStart + i;
        if (idx >= windowStart && idx <= windowEnd && idx < this._totalPagedCount && !this._pagedData.has(idx)) {
          this._pagedData.set(idx, cached[i]);
          changed = true;
        }
      }
    }

    if (changed) {
      this._emitData();
    }
  }

  private _fetchNextPage(): void {
    if (this._isLoading || !this._hasMore) return;

    this._isLoading = true;
    this._loading$.next(true);
    const page = this._nextPage;

    this.service
      .getPage(page)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (response) => {
          this._pageCache.set(page, response.items);
          const offset = this._totalPagedCount;
          response.items.forEach((item, i) => this._pagedData.set(offset + i, item));
          this._totalPagedCount += response.items.length;
          this._hasMore = response.hasMore;
          this._nextPage++;
          this._isLoading = false;
          this._loading$.next(false);
          this._emitData();
        },
        error: () => {
          this._isLoading = false;
          this._loading$.next(false);
        },
      });
  }

  private _emitData(): void {
    const newItems = this._newItems;
    const pagedData = this._pagedData;
    const newCount = newItems.length;
    const totalLength = newCount + this._totalPagedCount;

    // Proxy avoids allocating a dense array of totalLength slots. CDK virtual
    // scroll only needs `length` (for scroll-height) and `slice(start, end)`
    // (for the visible range), so those are the only members we implement.
    const combined = new Proxy([] as (Comment | null)[], {
      get(target, prop, receiver) {
        if (prop === 'length') return totalLength;
        if (prop === 'slice') {
          return (start = 0, end = totalLength) => {
            const s = Math.min(Math.max(start < 0 ? totalLength + start : start, 0), totalLength);
            const e = Math.min(Math.max(end < 0 ? totalLength + end : end, 0), totalLength);
            const result: (Comment | null)[] = [];
            for (let i = s; i < e; i++) {
              result.push(i < newCount ? newItems[i] : (pagedData.get(i - newCount) ?? null));
            }
            return result;
          };
        }
        const i = Number(prop);
        if (Number.isInteger(i) && i >= 0 && i < totalLength) {
          return i < newCount ? newItems[i] : (pagedData.get(i - newCount) ?? null);
        }
        return Reflect.get(target, prop, receiver);
      },
    });

    this._inMemoryCount = newCount + this._pagedData.size;
    this._data$.next(combined);
    this._inMemoryCount$.next(this._inMemoryCount);
  }
}
