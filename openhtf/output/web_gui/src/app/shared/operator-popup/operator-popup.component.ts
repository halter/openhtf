/**
 * Copyright 2024 Halter
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Component for displaying operator-facing popup modals.
 *
 * Shows localized error messages with optional images and a language toggle.
 * The modal blocks UI interaction until acknowledged.
 */

import { Component } from '@angular/core';

import {
  LANGUAGE_FLAGS,
  LANGUAGE_NAMES,
  LanguageCode,
  OperatorPopup,
  SUPPORTED_LANGUAGES
} from './operator-popup.model';
import { OperatorPopupService } from './operator-popup.service';

@Component({
  selector: 'htf-operator-popup',
  templateUrl: './operator-popup.component.html',
  styleUrls: ['./operator-popup.component.scss'],
})
export class OperatorPopupComponent {
  dropdownOpen = false;
  imageZoomed = false;

  constructor(private popupService: OperatorPopupService) {}

  get popup(): OperatorPopup | null {
    return this.popupService.currentPopup;
  }

  get currentLanguage(): LanguageCode {
    return this.popupService.currentLanguage;
  }

  get currentLanguageName(): string {
    return LANGUAGE_NAMES[this.currentLanguage];
  }

  get currentFlag(): string {
    return LANGUAGE_FLAGS[this.currentLanguage];
  }

  get languages(): LanguageCode[] {
    return SUPPORTED_LANGUAGES;
  }

  getLanguageName(lang: LanguageCode): string {
    return LANGUAGE_NAMES[lang];
  }

  getFlag(lang: LanguageCode): string {
    return LANGUAGE_FLAGS[lang];
  }

  selectLanguage(lang: LanguageCode): void {
    this.popupService.setLanguage(lang);
    this.dropdownOpen = false;
  }

  toggleDropdown(): void {
    this.dropdownOpen = !this.dropdownOpen;
  }

  openImageZoom(): void {
    this.imageZoomed = true;
  }

  closeImageZoom(): void {
    this.imageZoomed = false;
  }

  get title(): string {
    return this.popupService.getLocalizedText(this.popup ? this.popup.title : undefined, 'Error');
  }

  get description(): string {
    return this.popupService.getLocalizedText(this.popup ? this.popup.description : undefined, '');
  }

  get imageUrl(): string | null | undefined {
    return this.popup ? this.popup.image_url : null;
  }

  acknowledge(): void {
    this.popupService.acknowledge();
  }

  cycleLanguage(): void {
    this.popupService.cycleLanguage();
  }
}
