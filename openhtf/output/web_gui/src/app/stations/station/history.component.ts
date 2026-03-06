/**
 * Copyright 2022 Google LLC
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
 * Widget displaying previous test runs on a station.
 */

import { trigger } from '@angular/animations';
import { HttpClient } from '@angular/common/http';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';

import { ConfigService } from '../../core/config.service';
import { FlashMessageService } from '../../core/flash-message.service';
import { washAndExpandIn } from '../../shared/animations';
import { Station, StationStatus } from '../../shared/models/station.model';
import { TestState, TestStatus } from '../../shared/models/test-state.model';
import { getStationBaseUrl, messageFromErrorResponse } from '../../shared/util';

import { HistoryItem, HistoryItemStatus } from './history-item.model';
import { HistoryService } from './history.service';

// Emitted by the component when a test is selected or deselected.
export class TestSelectedEvent {
  constructor(public test: TestState) {}
}

const listItemHeight = 48;

@Component({
  animations: [trigger('animateIn', washAndExpandIn(listItemHeight))],
  selector: 'htf-history',
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.scss'],
})
export class HistoryComponent implements OnChanges {
  @Input() selectedTest: TestState|null;
  @Input() station: Station;
  @Output() onSelectTest = new EventEmitter<TestSelectedEvent>();
  @Output() exportModeChanged = new EventEmitter<boolean>();

  readonly initialDisplayCount = 5;
  readonly loadMoreCount = 10;
  HistoryItemStatus = HistoryItemStatus;
  TestStatus = TestStatus;
  displayLimit = 5;
  hasError = false;
  history: HistoryItem[] = [];
  historyFromDiskEnabled = false;
  isLoading = false;
  exportMode = false;
  isRemoteClient = false;

  private lastClickedItem: HistoryItem|null = null;

  constructor(
      private historyService: HistoryService,
      private flashMessage: FlashMessageService,
      private http: HttpClient,
      private config: ConfigService) {
    const host = window.location.hostname;
    this.isRemoteClient = host !== 'localhost' && host !== '127.0.0.1';
  }

  ngOnChanges(changes: SimpleChanges) {
    if ('station' in changes) {
      if (this.station.status === StationStatus.online) {
        // TODO(kenadia): The current behavior is that this only triggers when
        // the station page first loads. To better handle edge cases, the
        // history list should be refreshed when a new connection to a station
        // is established, for example if the user clicks on the refresh station
        // button, or if a station that was offline comes online.
        // I think that we can best accomplish this by making station objects
        // immutable. This will be done as part of a future refactor.
        this.loadHistory();
        this.history = this.historyService.getHistory(this.station);
      }
    }
  }

  isSelected(historyItem: HistoryItem) {
    return (
        historyItem.status === HistoryItemStatus.loaded &&
        historyItem.testState === this.selectedTest);
  }

  onClick(historyItem: HistoryItem) {
    if (this.exportMode) {
      this.toggleExportSelection(historyItem);
      return;
    }

    this.lastClickedItem = historyItem;

    if (historyItem.status === HistoryItemStatus.loading) {
      return;
    }

    // If the test state has been loaded already, select/deselect it.
    if (historyItem.status === HistoryItemStatus.loaded) {
      this.selectTest(historyItem.testState);

      if (historyItem.testState === this.selectedTest) {
        // The fileName will be null if the history item was created from a test
        // record/state retrieved by the StationService. We are unable to access
        // attachments until we know the file name, so try to retrieve it now.
        if (historyItem.testState.fileName === null) {
          this.historyService.retrieveFileName(this.station, historyItem)
              .catch(() => {
                if (this.historyFromDiskEnabled) {
                  this.flashMessage.warn(
                      'Could not retrieve history from disk, so attachments ' +
                      'are not available. You may try again later.');
                }
              });
        }
      }
      return;
    }

    this.historyService.loadItem(this.station, historyItem)
        .then((testState: TestState) => {
          if (this.lastClickedItem === historyItem) {
            this.selectTest(testState);
          }
        })
        .catch(error => {
          console.error(error.stack);
          const tooltip = messageFromErrorResponse(error);
          this.flashMessage.error('Error loading history item.', tooltip);
        });
  }

  loadMore() {
    this.displayLimit += this.loadMoreCount;
  }

  collapse() {
    this.displayLimit = this.initialDisplayCount;
  }

  enterExportMode() {
    this.exportMode = true;
    this.exportModeChanged.emit(true);
  }

  exitExportMode() {
    this.exportMode = false;
    this.history.forEach(item => item.selected = false);
    this.exportModeChanged.emit(false);
  }

  toggleExportSelection(historyItem: HistoryItem) {
    historyItem.selected = !historyItem.selected;
  }

  get selectedCount(): number {
    return this.history.filter(item => item.selected).length;
  }

  downloadCsv() {
    const selectedItems = this.history.filter(item => item.selected);

    if (selectedItems.length === 0) {
      this.flashMessage.warn('No items selected.');
      return;
    }

    // Items with fileNames go directly. Items without (e.g. latest test from
    // live state) are sent as identifiers for the backend to resolve.
    const fileNames = selectedItems
        .filter(item => item.fileName)
        .map(item => item.fileName);
    const identifiers = selectedItems
        .filter(item => !item.fileName)
        .map(item => ({dut_id: item.dutId, start_time_millis: item.startTimeMillis}));

    const baseUrl = getStationBaseUrl(this.config.dashboardEnabled, this.station);
    const url = `${baseUrl}/history/export`;
    const body = {file_names: fileNames, identifiers};

    this.http.post(url, body, {responseType: 'blob', observe: 'response'})
        .toPromise()
        .then(response => {
          // Extract filename from Content-Disposition header.
          const disposition = response.headers.get('Content-Disposition');
          let filename = 'export.csv';
          if (disposition) {
            const match = disposition.match(/filename="(.+)"/);
            if (match) {
              filename = match[1];
            }
          }

          // Trigger browser download.
          const blob = response.body;
          const downloadUrl = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = filename;
          a.click();
          window.URL.revokeObjectURL(downloadUrl);
        })
        .catch(error => {
          console.error(error);
          this.flashMessage.error('Failed to download CSV.');
        });
  }

  private loadHistory() {
    this.hasError = false;
    this.isLoading = true;
    this.historyFromDiskEnabled = false;

    this.historyService.refreshList(this.station)
        .then(() => {
          this.isLoading = false;
          this.historyFromDiskEnabled = true;
        })
        .catch(error => {
          this.isLoading = false;
          this.hasError = true;
          this.historyFromDiskEnabled = error.status !== 404;
        });
  }

  private selectTest(test: TestState) {
    if (test === this.selectedTest) {
      this.selectedTest = null;
    } else {
      this.selectedTest = test;
    }
    this.onSelectTest.emit(new TestSelectedEvent(this.selectedTest));
  }
}
