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
 * Tests for dashboard.service.ts.
 */

import { fakeAsync, tick } from '@angular/core/testing';

import { StationStatus } from '../../shared/models/station.model';
import { MockSockJsInstance, MockSockJsService } from '../../shared/sock-js.service.mock';

import { DashboardService, StationMap } from './dashboard.service';

describe('dashboard service', () => {
  let mockSockJsInstance: MockSockJsInstance;
  let mockSockJsService: MockSockJsService;
  let dashboardService: DashboardService;

  const addStationToMessage = (message: {}, port: string, status: string) => {
    const hostPort = `localhost:${port}`;
    message[hostPort] = {
      host: 'localhost',
      port,
      station_id: `mock-station-${port}`,
      status,
    };
  };

  const connectSuccessfully = () => {
    mockSockJsInstance.onopen();
  };

  const receiveMockMessage = (response: {}) => {
    mockSockJsInstance.onmessage({
      data: response,
    });
  };

  beforeEach(() => {
    // Set up SockJs mock.
    mockSockJsInstance = new MockSockJsInstance();
    mockSockJsService = new MockSockJsService();
    spyOn(mockSockJsService, 'sockJs').and.returnValue(mockSockJsInstance);

    // tslint:disable-next-line:no-any pass mock in place of real service
    dashboardService = new DashboardService(mockSockJsService as any);
  });

  it('should connect to the dashboard pubsub URL', () => {
    expect(mockSockJsService.sockJs).not.toHaveBeenCalled();
    expect(dashboardService.isSubscribing).toBe(false);
    expect(dashboardService.hasError).toBe(false);

    dashboardService.subscribe();

    expect(mockSockJsService.sockJs).toHaveBeenCalledWith('/sub/dashboard');
    expect(dashboardService.isSubscribing).toBe(true);
    expect(dashboardService.hasError).toBe(false);
  });

  it('should receive and parse station information', fakeAsync(() => {
       const stations: StationMap = dashboardService.stations;
       dashboardService.subscribe();

       connectSuccessfully();
       const message = {};
       addStationToMessage(message, '12000', 'ONLINE');
       addStationToMessage(message, '12001', 'UNREACHABLE');
       receiveMockMessage(message);
       tick();

       expect(dashboardService.isSubscribing).toBe(false);
       expect(dashboardService.hasError).toBe(false);

       // The API responses should be converted into Station objects.
       expect(Object.keys(stations).length).toEqual(2);
       expect(stations['localhost:12000'].stationId)
           .toEqual('mock-station-12000');
       expect(stations['localhost:12000'].status).toEqual(StationStatus.online);
       expect(stations['localhost:12001'].stationId)
           .toEqual('mock-station-12001');
       expect(stations['localhost:12001'].status)
           .toEqual(StationStatus.unreachable);
     }));

  it('should keep a station entry when its IP changes', fakeAsync(() => {
       const stations: StationMap = dashboardService.stations;
       dashboardService.subscribe();

       connectSuccessfully();
       receiveMockMessage({
         '10.4.18.21:4444': {
           host: '10.4.18.21',
           port: '4444',
           station_id: 'p5-fa-enter-cooling-cct-08-01',
           status: 'ONLINE',
         },
       });
       tick();
       const selectedStation = stations['10.4.18.21:4444'];

       receiveMockMessage({
         '127.0.0.1:4444': {
           host: '127.0.0.1',
           port: '4444',
           station_id: 'p5-fa-enter-cooling-cct-08-01',
           status: 'ONLINE',
         },
       });
       tick();

       expect(Object.keys(stations)).toEqual(['10.4.18.21:4444']);
       expect(stations['10.4.18.21:4444']).toBe(selectedStation);
       expect(selectedStation.host).toEqual('127.0.0.1');
     }));
});
