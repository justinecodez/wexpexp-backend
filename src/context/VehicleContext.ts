import { createContext } from '../utils/context';
import { Vehicle } from '../entities';
import { 
  VehicleResponse, 
  ServiceFilter, 
  BookingRequest, 
  BookingResponse,
  PaginationQuery 
} from '../types';

export interface VehicleContextType {
  // Vehicle management
  currentVehicle?: Vehicle;
  vehicleList: Vehicle[];
  vehicleFilters: ServiceFilter & { 
    vehicleType?: string; 
    withDriver?: boolean 
  };
  pagination: PaginationQuery;
  
  // Vehicle queries
  getVehicles: (filters: ServiceFilter) => Promise<VehicleResponse[]>;
  getVehicleById: (id: string) => Promise<VehicleResponse>;
  getVehiclesByLocation: (location: string, limit?: number) => Promise<VehicleResponse[]>;
  getVehicleTypes: () => Promise<Array<{ type: string; count: number }>>;
  
  // Availability management
  checkAvailability: (
    id: string,
    startDate: string,
    endDate: string
  ) => Promise<{ available: boolean; conflictingBookings?: any[] }>;
  
  // Booking management
  bookVehicle: (data: BookingRequest) => Promise<BookingResponse>;
  getUserBookings: (filters?: { status?: string }) => Promise<BookingResponse[]>;
  updateBooking: (
    id: string,
    data: { status?: string; paymentStatus?: string; specialRequests?: string }
  ) => Promise<BookingResponse>;
  cancelBooking: (id: string) => Promise<void>;
  
  // Loading states
  loading: boolean;
  error: Error | null;
}

export const VehicleContext = createContext<VehicleContextType>('VehicleContext');

export const useVehicleContext = () => {
  const context = VehicleContext.useContext();
  if (!context) {
    throw new Error('useVehicleContext must be used within a VehicleContextProvider');
  }
  return context;
};
