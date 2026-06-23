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
 * Widget displaying summary information about a test.
 */

import { Component, Input, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
import { Http } from '@angular/http';

import { ConfigService } from '../../core/config.service';
import { FlashMessageService } from '../../core/flash-message.service';
import { logLevels } from '../../shared/models/log-record.model';
import { Phase, PhaseStatus } from '../../shared/models/phase.model';
import { OutcomeDetail, TestState, TestStatus } from '../../shared/models/test-state.model';
import { ProgressBarComponent } from '../../shared/progress-bar.component';
import { getStationBaseUrl } from '../../shared/util';

@Component({
  selector: 'htf-test-summary',
  templateUrl: './test-summary.component.html',
  styleUrls: ['./test-summary.component.scss'],
})
export class TestSummaryComponent implements OnChanges {
  @Input() test: TestState;
  @ViewChild(ProgressBarComponent) progressBar: ProgressBarComponent;

  constructor(
      private http: Http,
      private config: ConfigService,
      private flashMessage: FlashMessageService) {}

  /**
   * Report an unexpected (unmapped) fault. POSTs to the station's /fault-report
   * relay — which forwards to hardware-test-service (the station GUI never calls
   * external services). Sends station + test context plus the error/critical
   * logs (the traceback).
   */
  reportFault(detail: OutcomeDetail) {
    const traceback = this.test.logs
                          .filter(log => log.level >= logLevels.error)
                          .map(log => log.message)
                          .join('\n\n') ||
        detail.issue;
    // Field names match hardware-test-service's IReportFaultRequestDTO. The
    // station relay fills in fixtureNumber (the canonical station id) before
    // forwarding, so we only send what the browser actually knows.
    const payload = {
      fixtureId: this.test.station.label,
      testPlan: this.test.name,
      dutId: this.test.dutId,
      code: detail.code,
      issue: detail.issue,
      traceback,
    };
    const baseUrl = getStationBaseUrl(this.config.dashboardEnabled, this.test.station);
    this.http.post(`${baseUrl}/fault-report`, JSON.stringify(payload)).subscribe(
        () => this.flashMessage.warn('Error reported to engineering.'),
        () => this.flashMessage.error(
            'Could not report the error — please ping engineering.'));
  }

  ngOnChanges(changes: SimpleChanges) {
    // When we get a new test, animate the progress bar from zero.
    if ('test' in changes && this.progressBar) {
      this.progressBar.reset();
    }
  }

  get completedPhaseCount() {
    if (this.test.status === TestStatus.waiting) {
      return 0;
    } else if (this.test.status === TestStatus.pass) {
      return this.test.phases.length;
    }

    let completedPhases = 0;
    for (const phase of this.test.phases) {
      if (phase.status === PhaseStatus.running ||
          phase.status === PhaseStatus.fail) {
        break;
      }
      completedPhases++;
    }
    return completedPhases;
  }

  get progressValue() {
    return this.completedPhaseCount / this.test.phases.length;
  }

  get runningPhase(): Phase|null {
    if (this.test.status === TestStatus.running) {
      for (const phase of this.test.phases) {
        if (phase.status === PhaseStatus.running) {
          return phase;
        }
      }
    }
    return null;
  }
}
