// Core API Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  pagination?: PaginationInfo;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Authentication Types
export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenVersion: number;
  iat?: number;
  exp?: number;
}

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  companyName?: string;
  businessType?: string;
}

export interface AuthResponse {
  user: UserProfile;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// User Types
export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: string;
  isVerified: boolean;
  profileImage?: string;
  companyName?: string;
  businessType?: string;
  createdAt: Date;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  companyName?: string;
  businessType?: string;
}

// Event Types
export interface CreateEventRequest {
  title: string;
  description?: string;
  eventType: string;
  eventDate: string;
  startTime: string;
  endTime?: string;
  hostname?: string;
  brideName?: string;
  groomName?: string;
  venueName?: string;
  venueAddress?: string;
  venueCity?: string;
  maxGuests: number;
  budget?: number;
  isPublic?: boolean;
  status?: string;
}

export interface EventResponse {
  id: string;
  title: string;
  description?: string;
  eventType: string;
  eventDate: string | Date;
  startTime: string;
  endTime?: string;
  hostname?: string;
  brideName?: string;
  groomName?: string;
  venueName?: string;
  venueAddress?: string;
  venueCity?: string;
  maxGuests: number;
  currentRsvpCount: number;
  budget?: number;
  currency: string;
  status: string;
  isPublic: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
  organizer?: {
    name: string;
    email?: string;
  };
  invitations?: any[];
  eCards?: any[];
}

export interface EventFilter {
  status?: string;
  eventType?: string;
  venueCity?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

// Invitation Types
export interface CreateInvitationRequest {
  eventId: string;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  invitationMethod: string;
  specialRequirements?: string;
}

export interface BulkInvitationRequest {
  eventId: string;
  invitations: CreateInvitationRequest[];
}

export interface InvitationResponse {
  id: string;
  eventId: string;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  invitationMethod: string;
  sentAt?: Date;
  deliveryStatus: string;
  rsvpStatus: string;
  rsvpAt?: Date;
  plusOneCount: number;
  qrCode?: string;
  checkInCode?: string;
  checkInTime?: Date;
  specialRequirements?: string;
  cardUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RSVPRequest {
  rsvpStatus: 'ACCEPTED' | 'DECLINED';
  plusOneCount?: number;
  specialRequirements?: string;
}

// Service Types
export interface ServiceFilter {
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  category?: string;
  availability?: boolean;
  search?: string;
}

export interface BookingRequest {
  serviceType: string;
  serviceId: string;
  bookingDate: string;
  startDate?: string;
  endDate?: string;
  guests?: number;
  specialRequests?: string;
}

export interface BookingResponse {
  id: string;
  serviceType: string;
  serviceId: string;
  bookingDate: Date;
  startDate?: Date;
  endDate?: Date;
  guests?: number;
  totalAmountTzs: number;
  currency: string;
  status: string;
  paymentStatus: string;
  specialRequests?: string;
  createdAt: Date;
}

// Tour Types
export interface TourResponse {
  id: string;
  name: string;
  description: string;
  duration: string;
  priceTzs: number;
  location: string;
  category: string;
  images?: string[];
  itinerary?: any;
  inclusions?: string[];
  exclusions?: string[];
  maxPeople: number;
  difficulty?: string;
  isActive: boolean;
}

// Vehicle Types
export interface VehicleResponse {
  id: string;
  make: string;
  model: string;
  year: number;
  vehicleType: string;
  dailyRateTzs: number;
  features?: any;
  seatingCapacity: number;
  transmission: string;
  fuelType: string;
  images?: string[];
  location: string;
  availability: boolean;
  withDriver: boolean;
  driverRateTzs?: number;
}

// Communication Types
export interface EmailRequest {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  attachments?: any[];
}

export interface SMSRequest {
  to: string | string[];
  message: string;
  scheduled?: Date;
  userId?: string;
}

export interface WhatsAppRequest {
  to: string | string[];
  message: string;
  type?: 'text' | 'template';
  templateName?: string;
  templateParams?: any;
  mediaUrl?: string;
  invitationId?: string;
  eventId?: string;
  useTemplate?: boolean; // Flag to use wedding invitation template
  includeCardAttachment?: boolean; // Flag to include card attachment (if false, use wedding_invite template)
  language?: 'en' | 'sw'; // Template language: English or Swahili
  templateVariables?: {
    guestname?: string;
    hostname?: string;
    bridename?: string;
    groomname?: string;
    eventdate?: string;
    venue?: string;
    starttime?: string;
    endtime?: string;
  }; // Custom template variable overrides
}

export interface MessageResponse {
  id: string;
  status: string;
  deliveredAt?: Date;
  errorMessage?: string;
  metadata?: {
    requiresTemplate?: boolean;
    errorCode?: number;
    [key: string]: any;
  };
}

// File Upload Types
export interface FileUploadResponse {
  filename: string;
  originalName: string;
  path: string;
  size: number;
  mimetype: string;
  url: string;
}

// Analytics Types
export interface EventAnalyticsResponse {
  totalInvitations: number;
  totalAccepted: number;
  totalDeclined: number;
  totalPending: number;
  totalCheckedIn: number;
  acceptanceRate: number;
  attendanceRate: number;
  deliveryRates: {
    email: number;
    sms: number;
    whatsapp: number;
  };
}

export interface DashboardStats {
  totalEvents: number;
  activeEvents: number;
  totalBookings: number;
  totalRevenue: number;
  recentActivity: any[];
}

// Tanzania Specific Types
export interface TanzanianPhoneNumber {
  raw: string;
  formatted: string;
  isValid: boolean;
  operator?: 'Vodacom' | 'Airtel' | 'Tigo' | 'Halotel' | 'TTCL';
}

export interface TanzanianAddress {
  street?: string;
  ward?: string;
  district?: string;
  region: string;
  city: TanzaniaCity;
  postalCode?: string;
}

export interface PaymentMethod {
  type: 'MPESA' | 'TIGO_PESA' | 'AIRTEL_MONEY' | 'BANK_TRANSFER';
  phoneNumber?: string;
  accountNumber?: string;
  reference?: string;
}

// Error Types
export interface AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  code?: string;
}

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

// Request Extensions
import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
  file?: Express.Multer.File;
  files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] };
}

// Enums
export enum TanzaniaCity {
  DAR_ES_SALAAM = 'DAR_ES_SALAAM',
  ARUSHA = 'ARUSHA',
  ZANZIBAR = 'ZANZIBAR',
  MWANZA = 'MWANZA',
  DODOMA = 'DODOMA',
  TANGA = 'TANGA',
  MOROGORO = 'MOROGORO',
  MBEYA = 'MBEYA',
  IRINGA = 'IRINGA',
  KILIMANJARO = 'KILIMANJARO',
}

export enum EventStatus {
  UPCOMING = 'UPCOMING',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum BookingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum ServiceType {
  TOUR = 'TOUR',
  VEHICLE = 'VEHICLE',
  ACCOMMODATION = 'ACCOMMODATION',
  VENUE = 'VENUE',
  DECORATION = 'DECORATION',
  CAR_IMPORT = 'CAR_IMPORT',
  INSURANCE = 'INSURANCE',
  BUDGET = 'BUDGET',
}
