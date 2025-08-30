import React, { useCallback, useEffect, useState } from 'react';
import { InvitationContext, InvitationContextType } from '../context/InvitationContext';
import { Invitation } from '../entities';
import {
  InvitationResponse,
  CreateInvitationRequest,
  BulkInvitationRequest,
  RSVPRequest,
  PaginationQuery,
} from '../types';
import { api } from '../utils/api';

interface InvitationProviderProps {
  children: React.ReactNode;
}

export function InvitationProvider({ children }: InvitationProviderProps) {
  const [currentInvitation, setCurrentInvitation] = useState<Invitation>();
  const [invitationList, setInvitationList] = useState<Invitation[]>([]);
  const [pagination, setPagination] = useState<PaginationQuery>({
    page: 1,
    limit: 10,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createInvitation = useCallback(
    async (data: CreateInvitationRequest): Promise<InvitationResponse> => {
      try {
        setLoading(true);
        const response = await api.post('/invitations', data);
        return response.data.data;
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const createBulkInvitations = useCallback(
    async (
      data: BulkInvitationRequest
    ): Promise<{
      successful: InvitationResponse[];
      failed: Array<{ invitation: CreateInvitationRequest; error: string }>;
    }> => {
      try {
        setLoading(true);
        const response = await api.post('/invitations/bulk', data);
        return response.data.data;
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const updateRSVP = useCallback(
    async (id: string, data: RSVPRequest): Promise<InvitationResponse> => {
      try {
        setLoading(true);
        const response = await api.put(`/invitations/${id}/rsvp`, data);
        return response.data.data;
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const resendInvitation = useCallback(async (id: string): Promise<void> => {
    try {
      setLoading(true);
      await api.post(`/invitations/${id}/resend`);
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteInvitation = useCallback(async (id: string): Promise<void> => {
    try {
      setLoading(true);
      await api.delete(`/invitations/${id}`);
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getEventInvitations = useCallback(
    async (eventId: string): Promise<InvitationResponse[]> => {
      try {
        setLoading(true);
        const response = await api.get(`/invitations/event/${eventId}`, {
          params: pagination,
        });
        setInvitationList(response.data.data);
        return response.data.data;
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [pagination]
  );

  const getInvitationByQR = useCallback(
    async (qrCode: string): Promise<InvitationResponse> => {
      try {
        setLoading(true);
        const response = await api.get(`/invitations/qr/${qrCode}`);
        return response.data.data;
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getInvitationStats = useCallback(async (eventId: string): Promise<any> => {
    try {
      setLoading(true);
      const response = await api.get(`/invitations/stats/${eventId}`);
      return response.data.data;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const importGuestsFromCSV = useCallback(
    async (
      eventId: string,
      file: File
    ): Promise<{
      successful: InvitationResponse[];
      failed: Array<{ row: any; error: string }>;
    }> => {
      try {
        setLoading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('eventId', eventId);

        const response = await api.post('/invitations/import-csv', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        return response.data.data;
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const exportGuestListToCSV = useCallback(async (eventId: string): Promise<string> => {
    try {
      setLoading(true);
      const response = await api.get(`/invitations/export-csv/${eventId}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `guest-list-${eventId}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      return url;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const sendReminders = useCallback(
    async (eventId: string): Promise<{ sent: number; failed: number }> => {
      try {
        setLoading(true);
        const response = await api.post(`/invitations/reminders/${eventId}`);
        return response.data.data;
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const checkInGuest = useCallback(
    async (qrCode: string): Promise<InvitationResponse> => {
      try {
        setLoading(true);
        const response = await api.post(`/invitations/qr/${qrCode}/checkin`);
        return response.data.data;
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Reset error when pagination changes
  useEffect(() => {
    setError(null);
  }, [pagination]);

  const contextValue: InvitationContextType = {
    currentInvitation,
    invitationList,
    pagination,
    createInvitation,
    createBulkInvitations,
    updateRSVP,
    resendInvitation,
    deleteInvitation,
    getEventInvitations,
    getInvitationByQR,
    getInvitationStats,
    importGuestsFromCSV,
    exportGuestListToCSV,
    sendReminders,
    checkInGuest,
    loading,
    error,
  };

  return (
    <InvitationContext.Provider value={contextValue}>{children}</InvitationContext.Provider>
  );
}
