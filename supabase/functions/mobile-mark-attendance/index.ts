import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MarkAttendanceRequest {
  sessionId: string;
  imageData: string; // base64 encoded image
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

    const { sessionId, imageData }: MarkAttendanceRequest = await req.json();

    console.log("Mobile attendance marking for session:", sessionId);

    // Verify session exists and is active
    const { data: session, error: sessionError } = await supabaseClient
      .from("attendance_sessions")
      .select("*")
      .eq("session_id", sessionId)
      .eq("status", "active")
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: "Session not found or inactive" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    // Convert base64 to blob
    const imageBlob = Uint8Array.from(atob(imageData), c => c.charCodeAt(0));

    // Call recognize-faces function
    const { data: recognitionData, error: recognitionError } = await supabaseClient.functions.invoke(
      "recognize-faces",
      {
        body: { image: imageBlob, sessionId },
      }
    );

    if (recognitionError) throw recognitionError;

    console.log("Recognition complete:", recognitionData);

    return new Response(
      JSON.stringify({ 
        success: true,
        ...recognitionData
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("Error marking attendance:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
};

serve(handler);
