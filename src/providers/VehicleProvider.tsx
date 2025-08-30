import React, { useCallback, useEffect, useState } from 'react';
import { VehicleContext, VehicleContextType } from '../context/VehicleContext';
import { Vehicle } from '../entities';
import { 
  VehicleResponse, 
  ServiceFilter, 
  BookingRequest, 
  BookingResponse, 
  PaginationQuery 
} from '../types';
import { api } from '../utils/api';

interface VehicleProviderProps {
  children: React.ReactNode;
}

export function VehicleProvider({ children }: VehicleProviderProps) {
  const [currentVehicle, setCurrentVehicle] = useState<Vehicle>();
  const [vehicleList, setVehicleList] = useState<Vehicle[]>([]);
  const [vehicleFilters, setVehicleFilters] = useState<ServiceFilter & {
    vehicleType?: string;
    withDriver?: boolean;
  }>({});
  const [pagination, setPagination] = useState<PaginationQuery>({
    page: 1,
    limit: 10,
    sortBy: 'dailyRateTzs',
    sortOrder: 'asc',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const getVehicles = useCallback(async (filters: ServiceFilter): Promise<VehicleResponse[]> => {
    try {
      setLoading(true);
      const response = await api.get('/vehicles', { params: { ...filters, ...pagination } });
      setVehicleList(response.data.data);
      return response.data.data;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [pagination]);

  const getVehicleById = useCallback(async (id: string): Promise<VehicleResponse> => {
    try {
      setLoading(true);
      const response = await api.get(`/vehicles/${id}`);
      return response.data.data;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getVehiclesByLocation = useCallback(async (location: string, limit?: number): Promise<VehicleResponse[]> => {
    try {
      setLoading(true);
      const response = await api.get(`/vehicles/location/${location}`, { params: { limit } });
      return response.data.data;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getVehicleTypes = useCallback(async (): Promise<Array<{ type: string; count: number }>> => {
    try {
      setLoading(true);
      const response = await api.get('/vehicles/types');
      return response.data.data;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const checkAvailability = useCallback(async (
    id: string,
    startDate: string,
    endDate: string
  ): Promise<{ available: boolean; conflictingBookings?: any[] }> => {
    try {
      setLoading(true);
      const response = await api.post(`/vehicles/${id}/check-availability`, {
        startDate,
        endDate,
      });
      return response.data.data;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const bookVehicle = useCallback(async (data: BookingRequest): Promise<BookingResponse> => {
    try {
      setLoading(true);
      const response = await api.post('/vehicles/book', data);
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
      const response = await api.get('/vehicles/bookings', { params: { ...filters, ...pagination } });
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
      const response = await api.put(`/vehicles/bookings/${id}`, data);
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
      await api.delete(`/vehicles/bookings/${id}`);
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
  }, [vehicleFilters, pagination]);

  const contextValue: VehicleContextType = {
    currentVehicle,
    vehicleList,
    vehicleFilters,
    pagination,
    getVehicles,
    getVehicleById,
    getVehiclesByLocation,
    getVehicleTypes,
    checkAvailability,
    bookVehicle,
    getUserBookings,
    updateBooking,
    cancelBooking,
    loading,
    error,
  };

  return <VehicleContext.Provider value={contextValue}>{children}</VehicleContext.Provider>;
}
