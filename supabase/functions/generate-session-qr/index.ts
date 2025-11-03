import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GenerateQRRequest {
  sessionId: string;
  className: string;
  subject?: string;
  validMinutes?: number;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const { sessionId, className, subject, validMinutes = 30 }: GenerateQRRequest = await req.json();

    console.log("Generating QR code for session:", sessionId);

    // Create QR code data
    const expiresAt = new Date(Date.now() + validMinutes * 60 * 1000);
    const qrData = JSON.stringify({
      sessionId,
      className,
      subject,
      timestamp: Date.now(),
    });

    // Save QR code to database
    const { data, error } = await supabaseClient
      .from("session_qr_codes")
      .insert({
        session_id: sessionId,
        class_name: className,
        subject: subject || null,
        qr_code_data: qrData,
        expires_at: expiresAt.toISOString(),
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;

    console.log("QR code generated successfully");

    return new Response(
      JSON.stringify({ 
        success: true,
        qrData: data.qr_code_data,
        expiresAt: data.expires_at,
        id: data.id
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("Error generating QR code:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
};

serve(handler);
