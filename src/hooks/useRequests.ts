import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Request {
  id: string;
  user_id: string;
  type: 'psicológico' | 'médico' | 'odontológico' | 'fisioterapia' | 'outros';
  description: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
  polo?: string;
  attachments?: string[];
  dependents?: Array<{
    name: string;
    relationship: string;
  }>;
  users?: {
    name: string;
    email: string;
    department?: string;
    polo?: string;
  };
}

export function useRequests() {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = async () => {
    if (!profile) return;

    try {
      setLoading(true);
      let query = supabase.from('requests').select(`
        *,
        users!requests_user_id_fkey (
          name,
          email,
          department,
          polo
        )
      `);

      // If user is solicitante, only show their requests
      if (profile.role === 'solicitante') {
        query = query.eq('user_id', profile.id);
      }

      // Order by creation date, newest first
      query = query.order('created_at', { ascending: false });

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      // Transform the data to match our Request interface
      const transformedData = (data || []).map(request => ({
        ...request,
        dependents: Array.isArray(request.dependents) 
          ? request.dependents as Array<{ name: string; relationship: string }>
          : []
      }));
      setRequests(transformedData);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const createRequest = async (requestData: {
    type: Request['type'];
    description: string;
    amount: number;
    polo: string;
    dependents?: Array<{ name: string; relationship: string }>;
    attachments?: string[];
  }) => {
    if (!profile) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('requests')
      .insert({
        user_id: profile.id,
        ...requestData,
      })
      .select()
      .single();

    if (error) throw error;

    // Refresh requests list
    await fetchRequests();
    return data;
  };

  const updateRequestStatus = async (
    requestId: string,
    status: 'approved' | 'rejected',
    rejectionReason?: string
  ) => {
    try {
      console.log('Updating request status:', { requestId, status, rejectionReason });
      
      // Get the current session to include the authorization token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase.functions.invoke('request-management', {
        body: {
          requestId,
          status,
          rejectionReason,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Erro ao atualizar status da solicitação');
      }

      console.log('Request status updated successfully:', data);
      
      // Refresh requests list
      await fetchRequests();
    } catch (error: any) {
      console.error('UpdateRequestStatus error:', error);
      throw error;
    }
  };

  useEffect(() => {
    if (profile) {
      fetchRequests();
    }
  }, [profile]);

  return {
    requests,
    loading,
    error,
    createRequest,
    updateRequestStatus,
    refetch: fetchRequests,
  };
}