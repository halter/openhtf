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

// In-flight state of a "Report to Halter" submission, tracked per fault detail
// so the operator gets a spinner then a clear good/fail result and can't fire
// the request repeatedly.
export enum ReportStatus {
  idle,
  sending,
  sent,
  error,
}

export type FaultPanelLanguage = 'en'|'th';

// localStorage key for the fault panel language. Stored globally (per browser,
// not per test/card) so an operator's choice sticks across tests and reloads.
const LANGUAGE_STORAGE_KEY = 'htf-fault-panel-language';

// Static fault-panel strings, hardcoded bilingual (the catalogue's per-fault
// text arrives already translated via description_th). The run-specific detail
// text is not translated.
const PANEL_LABELS: {[lang in FaultPanelLanguage]: {[key: string]: string}} = {
  en: {
    header: 'TEST FAILED — ACTION REQUIRED',
    headerDutFail: 'TEST FAILED — UNIT DID NOT MEET SPEC',
    whatToDo: 'What to do',
    escalateHint: `Steps didn't fix it? This raises an incident with the on-call team.`,
    escalateSending: 'Reporting…',
    escalateSent: '✓ Issue reported',
    escalateError: `✕ Couldn't report — tap to retry`,
    escalateIdle: 'Report Issue',
    unexpectedError: 'Unexpected error',
    unexpectedHint: `This isn't a known fault. Let Halter know so engineering can add a fix.`,
    reportSending: 'Sending…',
    reportSent: '✓ Sent to Halter',
    reportError: `Couldn't send — tap to retry`,
    reportIdle: 'Notify Halter',
    issue: 'Issue:',
  },
  th: {
    header: 'การทดสอบล้มเหลว — ต้องดำเนินการ',
    headerDutFail: 'การทดสอบล้มเหลว — ชิ้นงานไม่ผ่านเกณฑ์',
    whatToDo: 'สิ่งที่ต้องทำ',
    escalateHint: 'ทำตามขั้นตอนแล้วยังไม่หาย? ปุ่มนี้จะแจ้งเหตุไปยังทีมออนคอล',
    escalateSending: 'กำลังรายงาน…',
    escalateSent: '✓ รายงานแล้ว',
    escalateError: '✕ รายงานไม่สำเร็จ — แตะเพื่อลองใหม่',
    escalateIdle: 'รายงานปัญหา',
    unexpectedError: 'ข้อผิดพลาดที่ไม่รู้จัก',
    unexpectedHint: 'ไม่ใช่ข้อผิดพลาดที่รู้จัก แจ้ง Halter เพื่อให้วิศวกรเพิ่มวิธีแก้ไข',
    reportSending: 'กำลังส่ง…',
    reportSent: '✓ ส่งถึง Halter แล้ว',
    reportError: 'ส่งไม่สำเร็จ — แตะเพื่อลองใหม่',
    reportIdle: 'แจ้ง Halter',
    issue: 'ปัญหา:',
  },
};

@Component({
  selector: 'htf-test-summary',
  templateUrl: './test-summary.component.html',
  styleUrls: ['./test-summary.component.scss'],
})
export class TestSummaryComponent implements OnChanges {
  @Input() test: TestState;
  @ViewChild(ProgressBarComponent) progressBar: ProgressBarComponent;

  // Expose the enum to the template.
  readonly ReportStatus = ReportStatus;

  // Fault-panel language. Global (one setting for the whole GUI, persisted in
  // localStorage) — not per card. English is the default; Thai text falls back
  // to English per part when a fault has no translation.
  language: FaultPanelLanguage = this.loadLanguage();

  // Submission status keyed by a STABLE string (code + issue), NOT the
  // OutcomeDetail object: the station data is re-polled periodically and
  // makeTest rebuilds fresh OutcomeDetail instances each time, so an
  // object-keyed map would lose the spinner/sent/error state on the next poll
  // (the button would visibly revert). Two independent maps: one per action
  // (report an unknown fault vs escalate a known fault whose steps didn't help).
  private reportStatuses = new Map<string, ReportStatus>();
  private escalateStatuses = new Map<string, ReportStatus>();

  constructor(
      private http: Http,
      private config: ConfigService,
      private flashMessage: FlashMessageService) {}

  // Whether to show the operator fault panel. Shown when the failed test carries
  // structured outcome_details — EXCEPT on an aborted test: an abort is a reset
  // (e.g. the station service restarting on a deploy), not a fault, so its
  // details must not surface as an operator action.
  get showFaultPanel(): boolean {
    return !!(this.test && this.test.outcomeDetails &&
              this.test.outcomeDetails.length &&
              this.test.status !== TestStatus.aborted);
  }

  /**
   * The spec list split into prefix / emphasised / rest, per line.
   *
   * The bullet shape ('  - NAME = value') is owned by
   * fault_catalog._failing_measurements; change it there and the emphasis stops.
   */
  specLines(detail: OutcomeDetail): Array<{prefix: string, bold: string, rest: string}> {
    const dutId = this.test && this.test.dutId;
    return this.issueText(detail).split('\n').map(line => {
      const bulletMatch = line.match(/^(\s*-\s*)([^=]+?)(\s*=\s.*)$/);
      if (bulletMatch) {
        return {prefix: bulletMatch[1], bold: bulletMatch[2], rest: bulletMatch[3]};
      }
      const dutIndex = dutId ? line.indexOf(dutId) : -1;
      if (dutIndex >= 0) {
        return {
          prefix: line.slice(0, dutIndex),
          bold: dutId,
          rest: line.slice(dutIndex + dutId.length),
        };
      }
      return {prefix: line, bold: '', rest: ''};
    });
  }

  // Whether any detail on this panel can be notified/escalated. Header wording only.
  get anyNotifiable(): boolean {
    return !!(this.test && this.test.outcomeDetails &&
              this.test.outcomeDetails.some(detail => detail.notifiable));
  }

  // Stable identity for a fault detail across re-polls (object identity is not).
  private detailKey(detail: OutcomeDetail): string {
    return `${detail.code} ${detail.issue}`;
  }

  /** Static panel label in the current language. */
  label(key: string): string {
    return PANEL_LABELS[this.language][key];
  }

  setLanguage(language: FaultPanelLanguage) {
    this.language = language;
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch (e) {
      // Private mode / storage disabled: the toggle still works for the session.
    }
  }

  private loadLanguage(): FaultPanelLanguage {
    try {
      return localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'th' ? 'th' : 'en';
    } catch (e) {
      return 'en';
    }
  }

  /**
   * Per-fault text in the current language, falling back to English when the
   * catalogue entry has no Thai translation.
   */
  issueText(detail: OutcomeDetail): string {
    return (this.language === 'th' && detail.issueTh) ? detail.issueTh : detail.issue;
  }

  whatToDoText(detail: OutcomeDetail): string {
    return (this.language === 'th' && detail.whatToDoTh) ? detail.whatToDoTh :
                                                           detail.whatToDo;
  }

  reportStatus(detail: OutcomeDetail): ReportStatus {
    return this.reportStatuses.get(this.detailKey(detail)) || ReportStatus.idle;
  }

  escalateStatus(detail: OutcomeDetail): ReportStatus {
    return this.escalateStatuses.get(this.detailKey(detail)) || ReportStatus.idle;
  }

  /** A button is clickable only when nothing is in flight / already sent. */
  canReport(detail: OutcomeDetail): boolean {
    return this._isClickable(this.reportStatus(detail));
  }

  canEscalate(detail: OutcomeDetail): boolean {
    return this._isClickable(this.escalateStatus(detail));
  }

  /**
   * Report an unexpected (unmapped) fault — no remediation steps exist for it.
   * POSTs to the station's /fault-report relay (which forwards to
   * hardware-test-service; the station GUI never calls external services).
   */
  reportFault(detail: OutcomeDetail) {
    this._submitFault(detail, '/fault-report', this.reportStatuses);
  }

  /**
   * Escalate a KNOWN fault whose remediation steps did not resolve it. Distinct
   * from reportFault: this goes to the /fault-escalate relay, which raises a
   * higher-priority alert (a PagerDuty incident) rather than a routine report.
   */
  escalateFault(detail: OutcomeDetail) {
    this._submitFault(detail, '/fault-escalate', this.escalateStatuses);
  }

  private _isClickable(status: ReportStatus): boolean {
    return status === ReportStatus.idle || status === ReportStatus.error;
  }

  /**
   * Shared submit for both report and escalate. While the request is in flight
   * the button shows a spinner and is disabled; the result (sent / error) is
   * shown inline so the operator stops clicking. On error the button re-enables
   * so they can retry.
   */
  private _submitFault(
      detail: OutcomeDetail, endpoint: string,
      statuses: Map<string, ReportStatus>) {
    const key = this.detailKey(detail);
    if (!this._isClickable(statuses.get(key) || ReportStatus.idle)) {
      return;
    }
    statuses.set(key, ReportStatus.sending);

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
    this.http.post(`${baseUrl}${endpoint}`, JSON.stringify(payload)).subscribe(
        () => {
          statuses.set(key, ReportStatus.sent);
          this.flashMessage.warn('Reported to Halter.');
        },
        () => {
          statuses.set(key, ReportStatus.error);
          this.flashMessage.error(
              'Could not report — please ping Halter.');
        });
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
