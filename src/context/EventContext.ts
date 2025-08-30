import { createContext } from '../utils/context';
import { Event, EventAnalytics } from '../entities';
import { EventResponse, EventFilter, PaginationQuery } from '../types';

export interface EventContextType {
  // Event management
  currentEvent?: Event;
  eventList: Event[];
  eventFilters: EventFilter;
  pagination: PaginationQuery;
  
  // Event actions
  createEvent: (data: Partial<Event>) => Promise<EventResponse>;
  updateEvent: (id: string, data: Partial<Event>) => Promise<EventResponse>;
  deleteEvent: (id: string) => Promise<void>;
  
  // Event queries
  getEventById: (id: string) => Promise<EventResponse>;
  getUserEvents: (filters: EventFilter) => Promise<EventResponse[]>;
  getPublicEvents: (filters: EventFilter) => Promise<EventResponse[]>;
  
  // Event analytics
  getEventAnalytics: (id: string) => Promise<EventAnalytics>;
  getEventStats: () => Promise<any>;
  
  // Event utilities
  duplicateEvent: (id: string) => Promise<EventResponse>;
  updateEventStatus: (id: string, status: string) => Promise<EventResponse>;
  
  // Loading states
  loading: boolean;
  error: Error | null;
}

export const EventContext = createContext<EventContextType>('EventContext');

export const useEventContext = () => {
  const context = EventContext.useContext();
  if (!context) {
    throw new Error('useEventContext must be used within an EventContextProvider');
  }
  return context;
};
