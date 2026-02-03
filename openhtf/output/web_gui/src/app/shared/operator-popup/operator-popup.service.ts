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
 * Service for managing operator-facing popup queue.
 *
 * One popup is displayed at a time. If multiple popups are queued,
 * they are shown in order as each is acknowledged.
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  LanguageCode,
  OperatorPopup,
  SUPPORTED_LANGUAGES,
} from './operator-popup.model';

@Injectable()
export class OperatorPopupService {
  private queue: OperatorPopup[] = [];
  private currentPopupSubject = new BehaviorSubject<OperatorPopup | null>(null);
  private currentLanguageSubject: BehaviorSubject<LanguageCode>;

  /** Observable of the currently displayed popup, or null if none. */
  readonly currentPopup$: Observable<OperatorPopup | null> =
      this.currentPopupSubject.asObservable();

  /** Observable of the current language preference. */
  readonly currentLanguage$: Observable<LanguageCode>;

  constructor() {
    // Restore language preference from localStorage
    const storedLang = this.loadLanguagePreference();
    this.currentLanguageSubject = new BehaviorSubject<LanguageCode>(storedLang);
    this.currentLanguage$ = this.currentLanguageSubject.asObservable();
  }

  /** Get the currently displayed popup synchronously. */
  get currentPopup(): OperatorPopup | null {
    return this.currentPopupSubject.value;
  }

  /** Get the current language preference synchronously. */
  get currentLanguage(): LanguageCode {
    return this.currentLanguageSubject.value;
  }

  /**
   * Add a popup to the queue.
   * If no popup is currently showing, it will be displayed immediately.
   */
  show(popup: OperatorPopup): void {
    this.queue.push(popup);
    if (!this.currentPopupSubject.value) {
      this.showNext();
    }
    // Move focus to the popup overlay to prevent keyboard events reaching inputs behind it
    const focusPopup = () => {
      const overlay = document.getElementById('operator-popup-overlay');
      if (overlay) {
        const activeEl = document.activeElement as HTMLElement;
        if (activeEl && activeEl !== overlay) {
          if (activeEl.blur) {
            activeEl.blur();
          }
          overlay.focus();
        }
      }
    };
    // Focus overlay after Angular change detection settles
    setTimeout(focusPopup, 200);
  }

  /**
   * Acknowledge the current popup and show the next one in queue.
   */
  acknowledge(): void {
    this.queue.shift();
    this.showNext();

    // If no more popups, refocus the DUT scan input
    // Use 150ms delay to ensure Enter keyup event completes before focusing
    if (!this.currentPopupSubject.value) {
      setTimeout(() => {
        const input = document.querySelector('htf-user-input-plug input') as HTMLInputElement;
        if (input) {
          input.focus();
        }
      }, 150);
    }
  }

  /**
   * Set the language preference and persist to localStorage.
   */
  setLanguage(lang: LanguageCode): void {
    this.currentLanguageSubject.next(lang);
    this.saveLanguagePreference(lang);
  }

  /**
   * Cycle through supported languages: EN -> TH -> MY -> EN
   */
  cycleLanguage(): void {
    const currentIndex = SUPPORTED_LANGUAGES.indexOf(this.currentLanguage);
    const nextIndex = (currentIndex + 1) % SUPPORTED_LANGUAGES.length;
    this.setLanguage(SUPPORTED_LANGUAGES[nextIndex]);
  }

  /**
   * Get localized text for the current language, with fallback to English.
   */
  getLocalizedText(
      strings: { [key: string]: string } | undefined,
      fallback: string = ''
  ): string {
    if (!strings) {
      return fallback;
    }
    return strings[this.currentLanguage] || strings['en'] || fallback;
  }

  /** Clear all queued popups. */
  clearQueue(): void {
    this.queue = [];
    this.currentPopupSubject.next(null);
  }

  private showNext(): void {
    const nextPopup = this.queue[0] || null;
    this.currentPopupSubject.next(nextPopup);
  }

  private loadLanguagePreference(): LanguageCode {
    try {
      const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (stored && SUPPORTED_LANGUAGES.indexOf(stored as LanguageCode) !== -1) {
        return stored as LanguageCode;
      }
    } catch (e) {
      // localStorage may not be available
    }
    return DEFAULT_LANGUAGE;
  }

  private saveLanguagePreference(lang: LanguageCode): void {
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch (e) {
      // localStorage may not be available
    }
  }
}
