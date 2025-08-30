import React, { useCallback, useEffect, useState } from 'react';
import { EventContext, EventContextType } from '../context/EventContext';
import { Event, EventAnalytics } from '../entities';
import { EventResponse, EventFilter, PaginationQuery } from '../types';
import { api } from '../utils/api';

interface EventProviderProps {
  children: React.ReactNode;
}

export function EventProvider({ children }: EventProviderProps) {
  const [currentEvent, setCurrentEvent] = useState<Event>();
  const [eventList, setEventList] = useState<Event[]>([]);
  const [eventFilters, setEventFilters] = useState<EventFilter>({});
  const [pagination, setPagination] = useState<PaginationQuery>({
    page: 1,
    limit: 10,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createEvent = useCallback(async (data: Partial<Event>): Promise<EventResponse> => {
    try {
      setLoading(true);
      const response = await api.post('/events', data);
      return response.data.data;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateEvent = useCallback(async (id: string, data: Partial<Event>): Promise<EventResponse> => {
    try {
      setLoading(true);
      const response = await api.put(`/events/${id}`, data);
      return response.data.data;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteEvent = useCallback(async (id: string): Promise<void> => {
    try {
      setLoading(true);
      await api.delete(`/events/${id}`);
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getEventById = useCallback(async (id: string): Promise<EventResponse> => {
    try {
      setLoading(true);
      const response = await api.get(`/events/${id}`);
      return response.data.data;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getUserEvents = useCallback(async (filters: EventFilter): Promise<EventResponse[]> => {
    try {
      setLoading(true);
      const response = await api.get('/events', { params: { ...filters, ...pagination } });
      setEventList(response.data.data);
      return response.data.data;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [pagination]);

  const getPublicEvents = useCallback(async (filters: EventFilter): Promise<EventResponse[]> => {
    try {
      setLoading(true);
      const response = await api.get('/events/public', { params: { ...filters, ...pagination } });
      return response.data.data;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [pagination]);

  const getEventAnalytics = useCallback(async (id: string): Promise<EventAnalytics> => {
    try {
      setLoading(true);
      const response = await api.get(`/events/${id}/analytics`);
      return response.data.data;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getEventStats = useCallback(async (): Promise<any> => {
    try {
      setLoading(true);
      const response = await api.get('/events/stats');
      return response.data.data;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const duplicateEvent = useCallback(async (id: string): Promise<EventResponse> => {
    try {
      setLoading(true);
      const response = await api.post(`/events/${id}/duplicate`);
      return response.data.data;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateEventStatus = useCallback(async (id: string, status: string): Promise<EventResponse> => {
    try {
      setLoading(true);
      const response = await api.patch(`/events/${id}/status`, { status });
      return response.data.data;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Reset error when filters or pagination change
  useEffect(() => {
    setError(null);
  }, [eventFilters, pagination]);

  const contextValue: EventContextType = {
    currentEvent,
    eventList,
    eventFilters,
    pagination,
    createEvent,
    updateEvent,
    deleteEvent,
    getEventById,
    getUserEvents,
    getPublicEvents,
    getEventAnalytics,
    getEventStats,
    duplicateEvent,
    updateEventStatus,
    loading,
    error,
  };

  return <EventContext.Provider value={contextValue}>{children}</EventContext.Provider>;
}
