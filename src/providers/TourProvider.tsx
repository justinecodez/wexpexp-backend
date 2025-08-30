import React, { useCallback, useEffect, useState } from 'react';
import { TourContext, TourContextType } from '../context/TourContext';
import { Tour } from '../entities';
import { 
  TourResponse, 
  ServiceFilter, 
  BookingRequest, 
  BookingResponse, 
  PaginationQuery 
} from '../types';
import { api } from '../utils/api';

interface TourProviderProps {
  children: React.ReactNode;
}

export function TourProvider({ children }: TourProviderProps) {
  const [currentTour, setCurrentTour] = useState<Tour>();
  const [tourList, setTourList] = useState<Tour[]>([]);
  const [tourFilters, setTourFilters] = useState<ServiceFilter>({});
  const [pagination, setPagination] = useState<PaginationQuery>({
    page: 1,
    limit: 10,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const getTours = useCallback(async (filters: ServiceFilter): Promise<TourResponse[]> => {
    try {
      setLoading(true);
      const response = await api.get('/tours', { params: { ...filters, ...pagination } });
      setTourList(response.data.data);
      return response.data.data;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [pagination]);

  const getTourById = useCallback(async (id: string): Promise<TourResponse> => {
    try {
      setLoading(true);
      const response = await api.get(`/tours/${id}`);
      return response.data.data;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getPopularTours = useCallback(async (limit?: number): Promise<TourResponse[]> => {
    try {
      setLoading(true);
      const response = await api.get('/tours/popular', { params: { limit } });
      return response.data.data;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getToursByCategory = useCallback(async (category: string, limit?: number): Promise<TourResponse[]> => {
    try {
      setLoading(true);
      const response = await api.get(`/tours/category/${category}`, { params: { limit } });
      return response.data.data;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const bookTour = useCallback(async (data: BookingRequest): Promise<BookingResponse> => {
    try {
      setLoading(true);
      const response = await api.post('/tours/book', data);
      return response.data.data;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getUserBookings = useCallback(async (filters?: { status?: string }): Promise<BookingResponse[]> => {
    try {
      setLoading(true);
      const response = await api.get('/tours/bookings', { params: { ...filters, ...pagination } });
      return response.data.data;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [pagination]);

  const updateBooking = useCallback(async (
    id: string,
    data: { status?: string; paymentStatus?: string; specialRequests?: string }
  ): Promise<BookingResponse> => {
    try {
      setLoading(true);
      const response = await api.put(`/tours/bookings/${id}`, data);
      return response.data.data;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const cancelBooking = useCallback(async (id: string): Promise<void> => {
    try {
      setLoading(true);
      await api.delete(`/tours/bookings/${id}`);
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
  }, [tourFilters, pagination]);

  const contextValue: TourContextType = {
    currentTour,
    tourList,
    tourFilters,
    pagination,
    getTours,
    getTourById,
    getPopularTours,
    getToursByCategory,
    bookTour,
    getUserBookings,
    updateBooking,
    cancelBooking,
    loading,
    error,
  };

  return <TourContext.Provider value={contextValue}>{children}</TourContext.Provider>;
}
