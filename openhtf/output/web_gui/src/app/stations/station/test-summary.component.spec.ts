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
 * Tests for test-summary.component.ts.
 */

import {Component, NO_ERRORS_SCHEMA, Pipe, PipeTransform} from '@angular/core';
import {async, ComponentFixture, TestBed} from '@angular/core/testing';
import {Http} from '@angular/http';

import {ConfigService} from '../../core/config.service';
import {FlashMessageService} from '../../core/flash-message.service';
import {OutcomeDetail, TestState, TestStatus} from '../../shared/models/test-state.model';

import {TestSummaryComponent} from './test-summary.component';

function makePipeStub(name: string) {
  @Pipe({name})
  class PipeStub implements PipeTransform {
    transform() {
      return '';
    }
  }
  return PipeStub;
}

const pipeStubs = ['elapsedTime', 'statusToClass', 'statusToText'].map(makePipeStub);

function makeDetail(notifiable: boolean): OutcomeDetail {
  return {
    catalogueCode: '',
    code: 'ERR_PSU_NOT_FOUND',
    issue: 'Power supply not found',
    issueTh: '',
    notifiable,
    whatToDo: 'Check the power supply cable.',
    whatToDoTh: '',
  };
}

@Component({
  selector: 'unused',
  template: '<htf-test-summary [test]="test" [hasIncidentQr]="hasIncidentQr"></htf-test-summary>',
})
class HostComponent {
  hasIncidentQr = false;
  test = new TestState({
    dutId: 'mock-dut-id',
    name: 'mock-test',
    outcomeDetails: [makeDetail(true)],
    phases: [],
    startTimeMillis: null,
    status: TestStatus.fail,
  } as TestState);
}

describe('test summary component', () => {
  let fixture: ComponentFixture<HostComponent>;
  let element: HTMLElement;
  let hostComponent: HostComponent;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: (pipeStubs as Array<{}>).concat([HostComponent, TestSummaryComponent]),
      providers: [
        {provide: ConfigService, useValue: {dashboardEnabled: false}},
        {provide: FlashMessageService, useValue: {}},
        {provide: Http, useValue: {}},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    TestBed.compileComponents();
  }));

  beforeEach(() => {
    try {
      localStorage.removeItem('htf-fault-panel-language');
    } catch (e) {}
    fixture = TestBed.createComponent(HostComponent);
    element = fixture.nativeElement;
    hostComponent = fixture.componentInstance;
  });

  it('should offer Report Issue when the station has no incident report QR', () => {
    fixture.detectChanges();
    expect(element.querySelector('.operator-fault-escalate-button')).not.toBeNull();
    expect(element.textContent).not.toContain('support QR');
  });

  it('should point to the support QR instead of Report Issue when the station has one', () => {
    hostComponent.hasIncidentQr = true;
    fixture.detectChanges();
    expect(element.querySelector('.operator-fault-escalate-button')).toBeNull();
    expect(element.textContent).toContain('support QR');
  });

  it('should offer neither on a unit that did not meet spec', () => {
    hostComponent.test.outcomeDetails = [makeDetail(false)];
    for (const hasIncidentQr of [false, true]) {
      hostComponent.hasIncidentQr = hasIncidentQr;
      fixture.detectChanges();
      expect(element.querySelector('.operator-fault-escalate-button')).toBeNull();
      expect(element.textContent).not.toContain('support QR');
    }
  });
});
