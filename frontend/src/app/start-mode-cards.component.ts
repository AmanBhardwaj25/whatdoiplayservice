import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-start-mode-cards',
  templateUrl: './start-mode-cards.component.html',
  styleUrl: './start-mode-cards.component.css'
})
export class StartModeCardsComponent {
  @Output() startClassic = new EventEmitter<void>();

  onStartClassic(): void {
    this.startClassic.emit();
  }
}
