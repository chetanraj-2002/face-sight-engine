import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TrainingCompleteRequest {
  jobId: string;
  status: string;
  accuracy?: number;
  modelVersion?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { jobId, status, accuracy, modelVersion }: TrainingCompleteRequest = await req.json();

    console.log("Sending training complete notification for job:", jobId);

    // Get all department admins and super admins
    const { data: adminRoles, error: rolesError } = await supabaseClient
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["department_admin", "super_admin"]);

    if (rolesError) throw rolesError;

    const adminIds = adminRoles?.map(r => r.user_id) || [];

    // Get admin profiles
    const { data: profiles, error: profilesError } = await supabaseClient
      .from("profiles")
      .select("id, email, name")
      .in("id", adminIds);

    if (profilesError) throw profilesError;

    const statusEmoji = status === "completed" ? "✅" : "❌";
    const accuracyText = accuracy ? `<li><strong>Accuracy:</strong> ${(accuracy * 100).toFixed(2)}%</li>` : "";
    const versionText = modelVersion ? `<li><strong>Model Version:</strong> ${modelVersion}</li>` : "";

    // Send emails to admins
    const emailPromises = profiles?.map(async (profile) => {
      const { data: prefs } = await supabaseClient
        .from("notification_preferences")
        .select("email_training_complete")
        .eq("user_id", profile.id)
        .single();

      if (prefs?.email_training_complete === false) {
        console.log(`Skipping email for ${profile.email} - notifications disabled`);
        return null;
      }

      return resend.emails.send({
        from: "FaceSight <onboarding@resend.dev>",
        to: [profile.email],
        subject: `${statusEmoji} Training Job ${status === "completed" ? "Completed" : "Failed"}`,
        html: `
          <h2>Model Training Update</h2>
          <p>Dear ${profile.name},</p>
          <p>A model training job has ${status}:</p>
          <ul>
            <li><strong>Job ID:</strong> ${jobId}</li>
            <li><strong>Status:</strong> ${status}</li>
            ${accuracyText}
            ${versionText}
          </ul>
          <p>You can view more details in the Training section of the admin panel.</p>
          <br>
          <p>Best regards,<br>FaceSight System</p>
        `,
      });
    });

    const results = await Promise.allSettled(emailPromises || []);
    const successful = results.filter(r => r.status === "fulfilled").length;
    
    console.log(`Sent ${successful} training complete notifications`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: successful,
        total: profiles?.length || 0
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("Error sending training notifications:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
};

serve(handler);
