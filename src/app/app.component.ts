import {
  Component,
  OnInit,
  OnDestroy,
  ViewChildren,
  ViewChild,
  QueryList,
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { CdkVirtualScrollViewport, ScrollingModule } from '@angular/cdk/scrolling';
import { Subscription } from 'rxjs';

import { CommentDataProvider } from './services/comment-data-provider';
import { MockCommentService } from './services/mock-comment.service';
import { CommentCardComponent } from './components/comment-card/comment-card.component';
import { ScrollStatsComponent } from './components/scroll-stats/scroll-stats.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ScrollingModule, AsyncPipe, CommentCardComponent, ScrollStatsComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild(CdkVirtualScrollViewport) viewport!: CdkVirtualScrollViewport;
  @ViewChildren(CommentCardComponent) cardComponents!: QueryList<CommentCardComponent>;

  provider!: CommentDataProvider;
  totalFetched = 0;
  totalInMemory = 0;
  totalInDom = 0;
  firstVisibleIndex = 0;
  isLoading = false;

  private readonly subs = new Subscription();

  constructor(
    private readonly mockService: MockCommentService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.provider = new CommentDataProvider(this.mockService);

    this.subs.add(
      this.provider.comments$.subscribe((data) => {
        this.totalFetched = data.length;
        this.cdr.markForCheck();
      })
    );

    this.subs.add(
      this.provider.inMemoryCount$.subscribe((count) => {
        this.totalInMemory = count;
        this.cdr.markForCheck();
      })
    );

    this.subs.add(
      this.provider.loading$.subscribe((loading) => {
        this.isLoading = loading;
        this.cdr.markForCheck();
      })
    );
  }

  ngAfterViewInit(): void {
    this.subs.add(
      this.cardComponents.changes.subscribe(() => {
        this.totalInDom = this.cardComponents.length;
        this.cdr.markForCheck();
      })
    );
  }

  onScrolledIndexChange(index: number): void {
    this.firstVisibleIndex = index;
    const lastVisible = this.viewport.getRenderedRange().end;
    this.provider.onScrolled(index, lastVisible);
    this.cdr.markForCheck();
  }

  trackById(index: number, comment: { id: number } | null): number {
    // Null (evicted) slots must use the index as a unique key so CDK can
    // distinguish them from each other. Comment ids are always positive, so
    // -(index+1) never collides with a real id.
    return comment ? comment.id : -(index + 1);
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.provider.destroy();
  }
}
