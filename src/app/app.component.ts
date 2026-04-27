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
import { ScrollingModule as ExperimentalScrollingModule } from '@angular/cdk-experimental/scrolling';
import { Subscription } from 'rxjs';

import { CommentDataProvider } from './services/comment-data-provider';
import { MockWebSocketService } from './services/mock-websocket.service';
import { CommentCardComponent } from './components/comment-card/comment-card.component';
import { ScrollStatsComponent } from './components/scroll-stats/scroll-stats.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ScrollingModule, ExperimentalScrollingModule, AsyncPipe, CommentCardComponent, ScrollStatsComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild(CdkVirtualScrollViewport) viewport!: CdkVirtualScrollViewport;
  @ViewChildren(CommentCardComponent) cardComponents!: QueryList<CommentCardComponent>;

  totalFetched = 0;
  totalInMemory = 0;
  totalInDom = 0;
  firstVisibleIndex = 0;
  isLoading = false;

  private readonly subs = new Subscription();

  constructor(
    readonly provider: CommentDataProvider,
    private readonly wsService: MockWebSocketService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.subs.add(
      this.provider.comments$.subscribe((data) => {
        this.totalFetched = data.length;
        this.cdr.markForCheck();
      })
    );

    this.subs.add(
      this.wsService.messages$.subscribe((comment) => {
        // Capture "was near bottom" before appending so the new item's height
        // doesn't sway the decision.
        const el = this.viewport?.elementRef.nativeElement as HTMLElement | undefined;
        const wasNearBottom = !el ||
          el.scrollHeight - (el.scrollTop + el.clientHeight) < 300;

        this.provider.appendMessage(comment);

        if (wasNearBottom) {
          setTimeout(() => this.viewport.scrollTo({ bottom: 0 }));
        }
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

    // The autosize strategy doesn't support scrolledIndexChange, so derive the
    // current first-visible index from the rendered range stream instead.
    this.subs.add(
      this.viewport.renderedRangeStream.subscribe((range) => {
        this.firstVisibleIndex = range.start;
        this.provider.onScrolled(range.start, range.end);
        this.cdr.markForCheck();
      })
    );

    // Scroll to bottom once the first page of data is available.
    const scrollSub = this.provider.comments$.subscribe((data) => {
      if (data.length > 0) {
        scrollSub.unsubscribe();
        setTimeout(() => this.viewport.scrollTo({ bottom: 0 }));
      }
    });
  }

  trackById(index: number, comment: { id: number } | null): number {
    // Null (evicted) slots must use the index as a unique key so CDK can
    // distinguish them from each other. Comment ids are always positive, so
    // -(index+1) never collides with a real id.
    return comment ? comment.id : -(index + 1);
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }
}
