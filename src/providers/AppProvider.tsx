import React from 'react';
import { EventProvider } from './EventProvider';
import { InvitationProvider } from './InvitationProvider';
import { TourProvider } from './TourProvider';
import { VehicleProvider } from './VehicleProvider';

interface AppProviderProps {
  children: React.ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  return (
    <EventProvider>
      <InvitationProvider>
        <TourProvider>
          <VehicleProvider>
            {children}
          </VehicleProvider>
        </TourProvider>
      </InvitationProvider>
    </EventProvider>
  );
}
