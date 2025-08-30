import { createContext } from '../utils/context';
import { Tour } from '../entities';
import { 
  TourResponse, 
  ServiceFilter, 
  BookingRequest, 
  BookingResponse,
  PaginationQuery 
} from '../types';

export interface TourContextType {
  // Tour management
  currentTour?: Tour;
  tourList: Tour[];
  tourFilters: ServiceFilter;
  pagination: PaginationQuery;
  
  // Tour queries
  getTours: (filters: ServiceFilter) => Promise<TourResponse[]>;
  getTourById: (id: string) => Promise<TourResponse>;
  getPopularTours: (limit?: number) => Promise<TourResponse[]>;
  getToursByCategory: (category: string, limit?: number) => Promise<TourResponse[]>;
  
  // Booking management
  bookTour: (data: BookingRequest) => Promise<BookingResponse>;
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

export const TourContext = createContext<TourContextType>('TourContext');

export const useTourContext = () => {
  const context = TourContext.useContext();
  if (!context) {
    throw new Error('useTourContext must be used within a TourContextProvider');
  }
  return context;
};
