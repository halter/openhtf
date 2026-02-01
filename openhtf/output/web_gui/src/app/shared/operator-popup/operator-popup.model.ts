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
 * Model for operator-facing popup data from FrontendFriendlyError.
 */

export type LanguageCode = 'en' | 'th' | 'my';

export interface LocalizedStrings {
  [key: string]: string;  // Language code to string mapping
}

export interface OperatorPopup {
  title: LocalizedStrings;
  description: LocalizedStrings;
  image_url?: string | null;
}

export const SUPPORTED_LANGUAGES: LanguageCode[] = ['en', 'th', 'my'];

export const LANGUAGE_NAMES: { [key in LanguageCode]: string } = {
  'en': 'English',
  'th': 'ภาษาไทย',
  'my': 'မြန်မာ'
};

export const LANGUAGE_FLAGS: { [key in LanguageCode]: string } = {
  'en': 'images/flags/gb.svg',
  'th': 'images/flags/th.svg',
  'my': 'images/flags/mm.svg'
};

export const DEFAULT_LANGUAGE: LanguageCode = 'en';
export const LANGUAGE_STORAGE_KEY = 'operatorPopupLang';
