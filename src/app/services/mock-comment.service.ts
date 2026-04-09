import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { Comment } from '../models/comment.model';

const PAGE_SIZE = 20;
const NETWORK_DELAY_MS = 400;

const LOREM_SENTENCES = [
  'Curabitur pretium tincidunt lacus.',
  'Nulla gravida orci a odio, et tempus feugiat.',
  'Nullam varius, turpis molestie pretium tincidunt, arcu nisi luctus nunc, eu aliquet lorem libero vitae quam.',
  'Aenean lacinia bibendum nulla sed consectetur.',
  'Sed posuere consectetur est at lobortis.',
  'Donec ullamcorper nulla non metus auctor fringilla.',
  'Vestibulum id ligula porta felis euismod semper.',
  'Praesent commodo cursus magna, vel scelerisque nisl consectetur.',
  'Fusce dapibus, tellus ac cursus commodo, tortor mauris condimentum nibh.',
  'Integer posuere erat a ante venenatis dapibus posuere velit aliquet.',
];

function generateBody(id: number): string {
  // Variable length: 1–8 sentences based on id
  const sentenceCount = (id % 8) + 1;
  return Array.from({ length: sentenceCount }, (_, i) =>
    LOREM_SENTENCES[(id + i) % LOREM_SENTENCES.length]
  ).join(' ');
}

function generatePage(page: number): Comment[] {
  const start = page * PAGE_SIZE;
  return Array.from({ length: PAGE_SIZE }, (_, i) => {
    const id = start + i + 1;
    return {
      id,
      title: `Comment #${id} — Page ${page + 1}`,
      body: generateBody(id),
    };
  });
}

export interface PageResponse {
  items: Comment[];
  hasMore: boolean;
}

@Injectable({ providedIn: 'root' })
export class MockCommentService {
  readonly pageSize = PAGE_SIZE;

  getPage(page: number): Observable<PageResponse> {
    return of({
      items: generatePage(page),
      hasMore: true,
    }).pipe(delay(NETWORK_DELAY_MS));
  }
}
