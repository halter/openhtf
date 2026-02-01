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

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { OperatorPopup } from './operator-popup.model';
import { OperatorPopupComponent } from './operator-popup.component';
import { OperatorPopupService } from './operator-popup.service';

describe('OperatorPopupComponent', () => {
  let component: OperatorPopupComponent;
  let fixture: ComponentFixture<OperatorPopupComponent>;
  let mockService: any;
  let currentPopup: OperatorPopup | null;
  let currentLanguage: 'en' | 'th' | 'my';

  beforeEach(() => {
    currentPopup = null;
    currentLanguage = 'en';

    mockService = {
      acknowledge: jasmine.createSpy('acknowledge'),
      cycleLanguage: jasmine.createSpy('cycleLanguage'),
      getLocalizedText: jasmine.createSpy('getLocalizedText').and.callFake(
        (strings: any, fallback: string = '') => {
          if (!strings) return fallback;
          return strings[currentLanguage] || strings['en'] || fallback;
        }
      ),
      get currentPopup() { return currentPopup; },
      get currentLanguage() { return currentLanguage; }
    };

    TestBed.configureTestingModule({
      declarations: [OperatorPopupComponent],
      providers: [
        { provide: OperatorPopupService, useValue: mockService }
      ]
    });

    fixture = TestBed.createComponent(OperatorPopupComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('when no popup is showing', () => {
    beforeEach(() => {
      currentPopup = null;
      fixture.detectChanges();
    });

    it('should not render the overlay', () => {
      const overlay = fixture.debugElement.query(By.css('.operator-popup-overlay'));
      expect(overlay).toBeNull();
    });
  });

  describe('when popup is showing', () => {
    beforeEach(() => {
      currentPopup = {
        title: { en: 'English Title', th: 'Thai Title' },
        description: { en: 'English Desc', th: 'Thai Desc' }
      };
      fixture.detectChanges();
    });

    it('should render the overlay', () => {
      const overlay = fixture.debugElement.query(By.css('.operator-popup-overlay'));
      expect(overlay).not.toBeNull();
    });

    it('should display title in current language', () => {
      const title = fixture.nativeElement.querySelector('.operator-popup-title');
      expect(title.textContent).toContain('English Title');
    });

    it('should display description in current language', () => {
      const desc = fixture.nativeElement.querySelector('.operator-popup-description');
      expect(desc.textContent).toContain('English Desc');
    });

    it('should show current language code', () => {
      const langCode = fixture.nativeElement.querySelector('.lang-code');
      expect(langCode.textContent).toContain('EN');
    });

    it('should call acknowledge on button click', () => {
      const btn = fixture.nativeElement.querySelector('.acknowledge-btn');
      btn.click();
      expect(mockService.acknowledge).toHaveBeenCalled();
    });

    it('should call cycleLanguage on toggle click', () => {
      const toggle = fixture.nativeElement.querySelector('.lang-toggle');
      toggle.click();
      expect(mockService.cycleLanguage).toHaveBeenCalled();
    });
  });

  describe('with image', () => {
    beforeEach(() => {
      currentPopup = {
        title: { en: 'Test' },
        description: { en: 'Desc' },
        image_url: '/img/test.png'
      };
      fixture.detectChanges();
    });

    it('should display image when provided', () => {
      const img = fixture.nativeElement.querySelector('.operator-popup-image');
      expect(img).not.toBeNull();
      expect(img.src).toContain('/img/test.png');
    });
  });

  describe('without image', () => {
    beforeEach(() => {
      currentPopup = {
        title: { en: 'Test' },
        description: { en: 'Desc' }
      };
      fixture.detectChanges();
    });

    it('should not display image when not provided', () => {
      const img = fixture.nativeElement.querySelector('.operator-popup-image');
      expect(img).toBeNull();
    });
  });

  describe('language switching', () => {
    beforeEach(() => {
      currentPopup = {
        title: { en: 'English', th: 'Thai', my: 'Myanmar' },
        description: { en: 'Desc EN', th: 'Desc TH', my: 'Desc MY' }
      };
    });

    it('should display content in Thai when language is Thai', () => {
      currentLanguage = 'th';
      fixture.detectChanges();

      const title = fixture.nativeElement.querySelector('.operator-popup-title');
      expect(title.textContent).toContain('Thai');

      const langCode = fixture.nativeElement.querySelector('.lang-code');
      expect(langCode.textContent).toContain('TH');
    });

    it('should display content in Myanmar when language is Myanmar', () => {
      currentLanguage = 'my';
      fixture.detectChanges();

      const title = fixture.nativeElement.querySelector('.operator-popup-title');
      expect(title.textContent).toContain('Myanmar');

      const langCode = fixture.nativeElement.querySelector('.lang-code');
      expect(langCode.textContent).toContain('MY');
    });
  });
});
