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

import { LANGUAGE_STORAGE_KEY, OperatorPopup } from './operator-popup.model';
import { OperatorPopupService } from './operator-popup.service';

describe('OperatorPopupService', () => {
  let service: OperatorPopupService;

  beforeEach(() => {
    localStorage.clear();
    service = new OperatorPopupService();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('show()', () => {
    it('should show popup immediately when queue is empty', () => {
      const popup: OperatorPopup = {
        title: { en: 'Test' },
        description: { en: 'Desc' }
      };
      service.show(popup);
      expect(service.currentPopup).toEqual(popup);
    });

    it('should queue popups when one is already showing', () => {
      const popup1: OperatorPopup = {
        title: { en: 'First' },
        description: { en: 'Desc' }
      };
      const popup2: OperatorPopup = {
        title: { en: 'Second' },
        description: { en: 'Desc' }
      };
      service.show(popup1);
      service.show(popup2);
      expect(service.currentPopup!.title.en).toBe('First');
    });
  });

  describe('acknowledge()', () => {
    it('should show next popup after acknowledge', () => {
      const popup1: OperatorPopup = {
        title: { en: 'First' },
        description: { en: 'Desc' }
      };
      const popup2: OperatorPopup = {
        title: { en: 'Second' },
        description: { en: 'Desc' }
      };
      service.show(popup1);
      service.show(popup2);
      service.acknowledge();
      expect(service.currentPopup!.title.en).toBe('Second');
    });

    it('should clear popup when queue is exhausted', () => {
      const popup: OperatorPopup = {
        title: { en: 'Test' },
        description: { en: 'Desc' }
      };
      service.show(popup);
      service.acknowledge();
      expect(service.currentPopup).toBeNull();
    });

    it('should handle acknowledge when no popup is showing', () => {
      expect(() => service.acknowledge()).not.toThrow();
      expect(service.currentPopup).toBeNull();
    });
  });

  describe('language management', () => {
    it('should default to English', () => {
      expect(service.currentLanguage).toBe('en');
    });

    it('should persist language preference in localStorage', () => {
      service.setLanguage('th');
      expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('th');
      expect(service.currentLanguage).toBe('th');
    });

    it('should restore language preference from localStorage', () => {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, 'my');
      const newService = new OperatorPopupService();
      expect(newService.currentLanguage).toBe('my');
    });

    it('should cycle language: EN -> TH -> MY -> EN', () => {
      expect(service.currentLanguage).toBe('en');
      service.cycleLanguage();
      expect(service.currentLanguage).toBe('th');
      service.cycleLanguage();
      expect(service.currentLanguage).toBe('my');
      service.cycleLanguage();
      expect(service.currentLanguage).toBe('en');
    });

    it('should ignore invalid language in localStorage', () => {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, 'invalid');
      const newService = new OperatorPopupService();
      expect(newService.currentLanguage).toBe('en');
    });
  });

  describe('getLocalizedText()', () => {
    it('should return text in current language', () => {
      const strings = { en: 'English', th: 'Thai' };
      expect(service.getLocalizedText(strings)).toBe('English');
      service.setLanguage('th');
      expect(service.getLocalizedText(strings)).toBe('Thai');
    });

    it('should fallback to English if current language not available', () => {
      service.setLanguage('my');
      const strings = { en: 'English', th: 'Thai' };
      expect(service.getLocalizedText(strings)).toBe('English');
    });

    it('should return fallback if strings undefined', () => {
      expect(service.getLocalizedText(undefined, 'default')).toBe('default');
    });

    it('should return empty string if no fallback and strings undefined', () => {
      expect(service.getLocalizedText(undefined)).toBe('');
    });
  });

  describe('clearQueue()', () => {
    it('should clear all queued popups', () => {
      service.show({ title: { en: '1' }, description: { en: '1' } });
      service.show({ title: { en: '2' }, description: { en: '2' } });
      service.clearQueue();
      expect(service.currentPopup).toBeNull();
    });
  });

  describe('observables', () => {
    it('should emit popup changes through currentPopup$', (done) => {
      const popup: OperatorPopup = {
        title: { en: 'Test' },
        description: { en: 'Desc' }
      };
      const emissions: (OperatorPopup | null)[] = [];
      service.currentPopup$.subscribe(p => {
        emissions.push(p);
        if (emissions.length === 2) {
          expect(emissions[0]).toBeNull();
          expect(emissions[1]).toEqual(popup);
          done();
        }
      });
      service.show(popup);
    });

    it('should emit language changes through currentLanguage$', (done) => {
      const emissions: string[] = [];
      service.currentLanguage$.subscribe(lang => {
        emissions.push(lang);
        if (emissions.length === 2) {
          expect(emissions[0]).toBe('en');
          expect(emissions[1]).toBe('th');
          done();
        }
      });
      service.setLanguage('th');
    });
  });
});
