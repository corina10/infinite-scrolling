import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-scroll-stats',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './scroll-stats.component.html',
  styleUrl: './scroll-stats.component.scss',
})
export class ScrollStatsComponent {
  @Input() totalFetched = 0;
  @Input() totalInMemory = 0;
  @Input() totalInDom = 0;
  @Input() firstVisibleIndex = 0;
  @Input() isLoading = false;
}
