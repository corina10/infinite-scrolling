import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Comment } from '../models/comment.model';
import { MockCommentService } from './mock-comment.service';

const LOOKAHEAD_BUFFER = 15;
const MEMORY_WINDOW_HALF = 30;

export class CommentDataProvider {
  private readonly _data$ = new BehaviorSubject<(Comment | null)[]>([]);
  private readonly _loading$ = new Subject<boolean>();
  private readonly _inMemoryCount$ = new BehaviorSubject<number>(0);
  private readonly _destroy$ = new Subject<void>();

  private _isLoading = false;
  private readonly _pageCache = new Map<number, Comment[]>();
  private _nextPage = 0;
  private _hasMore = true;

  readonly comments$: Observable<(Comment | null)[]> = this._data$.asObservable();
  readonly loading$: Observable<boolean> = this._loading$.asObservable();
  readonly inMemoryCount$: Observable<number> = this._inMemoryCount$.asObservable();

  get totalFetched(): number {
    return this._data$.value.length;
  }

  constructor(private readonly service: MockCommentService) {
    this._fetchNextPage();
  }

  /**
   * Called by the component on each scroll event with the first and last
   * visible indices. Handles both memory eviction/restoration and
   * triggering the next page load when approaching the end.
   */
  onScrolled(firstVisible: number, lastVisible: number): void {
    this._evictAndRestore(firstVisible);
    if (lastVisible >= this._data$.value.length - LOOKAHEAD_BUFFER) {
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
    const data = this._data$.value;
    const pageSize = this.service.pageSize;
    const windowStart = Math.max(0, firstVisible - MEMORY_WINDOW_HALF);
    const windowEnd = Math.min(data.length - 1, firstVisible + MEMORY_WINDOW_HALF);

    let changed = false;

    for (let i = 0; i < data.length; i++) {
      if (data[i] !== null && (i < windowStart || i > windowEnd)) {
        data[i] = null;
        changed = true;
      }
    }

    const startPage = Math.floor(windowStart / pageSize);
    const endPage = Math.floor(windowEnd / pageSize);

    for (let page = startPage; page <= endPage; page++) {
      const cached = this._pageCache.get(page);
      if (!cached) continue;

      const pageStart = page * pageSize;
      for (let i = 0; i < cached.length; i++) {
        const idx = pageStart + i;
        if (idx >= windowStart && idx <= windowEnd && idx < data.length && data[idx] === null) {
          data[idx] = cached[i];
          changed = true;
        }
      }
    }

    if (changed) {
      this._data$.next([...data]);
      this._inMemoryCount$.next(data.filter(Boolean).length);
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
          const updated = [...this._data$.value, ...response.items];
          this._data$.next(updated);
          this._inMemoryCount$.next(updated.filter(Boolean).length);
          this._hasMore = response.hasMore;
          this._nextPage++;
          this._isLoading = false;
          this._loading$.next(false);
        },
        error: () => {
          this._isLoading = false;
          this._loading$.next(false);
        },
      });
  }
}
