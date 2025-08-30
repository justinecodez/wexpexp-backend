import { createContext } from '../utils/context';
import { Invitation } from '../entities';
import { 
  InvitationResponse, 
  CreateInvitationRequest, 
  BulkInvitationRequest,
  RSVPRequest,
  PaginationQuery 
} from '../types';

export interface InvitationContextType {
  // Invitation management
  currentInvitation?: Invitation;
  invitationList: Invitation[];
  pagination: PaginationQuery;
  
  // Invitation actions
  createInvitation: (data: CreateInvitationRequest) => Promise<InvitationResponse>;
  createBulkInvitations: (data: BulkInvitationRequest) => Promise<{
    successful: InvitationResponse[];
    failed: Array<{ invitation: CreateInvitationRequest; error: string }>;
  }>;
  updateRSVP: (id: string, data: RSVPRequest) => Promise<InvitationResponse>;
  resendInvitation: (id: string) => Promise<void>;
  deleteInvitation: (id: string) => Promise<void>;
  
  // Invitation queries
  getEventInvitations: (eventId: string) => Promise<InvitationResponse[]>;
  getInvitationByQR: (qrCode: string) => Promise<InvitationResponse>;
  getInvitationStats: (eventId: string) => Promise<any>;
  
  // Invitation utilities
  importGuestsFromCSV: (eventId: string, file: File) => Promise<{
    successful: InvitationResponse[];
    failed: Array<{ row: any; error: string }>;
  }>;
  exportGuestListToCSV: (eventId: string) => Promise<string>;
  sendReminders: (eventId: string) => Promise<{ sent: number; failed: number }>;
  checkInGuest: (qrCode: string) => Promise<InvitationResponse>;
  
  // Loading states
  loading: boolean;
  error: Error | null;
}

export const InvitationContext = createContext<InvitationContextType>('InvitationContext');

export const useInvitationContext = () => {
  const context = InvitationContext.useContext();
  if (!context) {
    throw new Error('useInvitationContext must be used within an InvitationContextProvider');
  }
  return context;
};
