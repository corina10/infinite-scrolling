import { Injectable } from '@angular/core';
import { Observable, interval } from 'rxjs';
import { map } from 'rxjs/operators';
import { Comment } from '../models/comment.model';

const WS_INTERVAL_MS = 5000;

// Use a high ID range to avoid collisions with sequential paged IDs (1, 2, 3…)
// and with the negative IDs used by trackBy for evicted null slots.
const WS_ID_START = 1_000_000;

const LIVE_BODIES = [
  'This is a newly added comment',
  'A short live update.',
  'Live messages can be longer too — varying lengths help exercise the autosize virtual scroll strategy and confirm that the spacer adjusts correctly as content arrives.',
  'Another quick one.',
  'Mid-length live update with a couple of extra clauses to push the height up a bit, but not too much.',
];

@Injectable({ providedIn: 'root' })
export class MockWebSocketService {
  private _counter = 0;

  readonly messages$: Observable<Comment> = interval(WS_INTERVAL_MS).pipe(
    map(() => {
      const n = ++this._counter;
      return {
        id: WS_ID_START + n,
        title: `Live update #${n}`,
        body: LIVE_BODIES[(n - 1) % LIVE_BODIES.length],
      };
    })
  );
}
