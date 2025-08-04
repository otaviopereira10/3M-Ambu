import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UpdateRequestBody {
  requestId: string;
  status: 'approved' | 'rejected';
  rejectionReason?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    console.log('Auth header:', authHeader ? 'Present' : 'Missing');
    
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Create Supabase client with service role for admin operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    if (req.method === 'POST') {
      const { requestId, status, rejectionReason }: UpdateRequestBody = await req.json();
      console.log('Request data:', { requestId, status, rejectionReason });

      // Update request status
      const updateData: any = {
        status,
        approved_at: new Date().toISOString(),
      };

      if (status === 'rejected' && rejectionReason) {
        updateData.rejection_reason = rejectionReason;
      }

      console.log('Updating request with data:', updateData);

      const { data: updatedRequest, error: updateError } = await supabaseClient
        .from('requests')
        .update(updateData)
        .eq('id', requestId)
        .select()
        .single();

      if (updateError) {
        console.error('Update error:', updateError);
        throw new Error(`Failed to update request: ${updateError.message}`);
      }

      console.log('Request updated successfully:', updatedRequest);

      // Call email notification function
      try {
        await supabaseClient.functions.invoke('send-notification-email', {
          body: { requestId, action: status, rejectionReason }
        });
        console.log('Email notification sent');
      } catch (emailError) {
        console.error('Failed to send email notification:', emailError);
        // Don't fail the main operation if email fails
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          data: updatedRequest,
          message: `Request ${status} successfully` 
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error('Error in request-management function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Check function logs for more information'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);