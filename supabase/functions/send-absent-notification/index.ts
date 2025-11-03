import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AbsentNotificationRequest {
  sessionId: string;
  className: string;
  subject: string;
  date: string;
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

    const { sessionId, className, subject, date }: AbsentNotificationRequest = await req.json();

    console.log("Processing absent notifications for session:", sessionId);

    // Get all students in the class
    const { data: allStudents, error: studentsError } = await supabaseClient
      .from("users")
      .select("id, usn, name, profile_id")
      .eq("class", className);

    if (studentsError) throw studentsError;

    // Get students who attended
    const { data: attendedStudents, error: attendanceError } = await supabaseClient
      .from("attendance_logs")
      .select("usn")
      .eq("session_id", sessionId);

    if (attendanceError) throw attendanceError;

    const attendedUsns = new Set(attendedStudents?.map(a => a.usn) || []);
    const absentStudents = allStudents?.filter(s => !attendedUsns.has(s.usn)) || [];

    console.log(`Found ${absentStudents.length} absent students`);

    // Get profiles with emails for absent students
    const { data: profiles, error: profilesError } = await supabaseClient
      .from("profiles")
      .select("id, email, name")
      .in("id", absentStudents.map(s => s.profile_id).filter(Boolean));

    if (profilesError) throw profilesError;

    // Get notification preferences and send emails
    const emailPromises = profiles?.map(async (profile) => {
      const { data: prefs } = await supabaseClient
        .from("notification_preferences")
        .select("email_absent_notifications")
        .eq("user_id", profile.id)
        .single();

      if (prefs?.email_absent_notifications === false) {
        console.log(`Skipping email for ${profile.email} - notifications disabled`);
        return null;
      }

      return resend.emails.send({
        from: "FaceSight <onboarding@resend.dev>",
        to: [profile.email],
        subject: `Absence Notice: ${subject} - ${date}`,
        html: `
          <h2>Attendance Notice</h2>
          <p>Dear ${profile.name},</p>
          <p>You were marked absent for the following session:</p>
          <ul>
            <li><strong>Class:</strong> ${className}</li>
            <li><strong>Subject:</strong> ${subject}</li>
            <li><strong>Date:</strong> ${date}</li>
          </ul>
          <p>If you believe this is an error, please contact your instructor.</p>
          <br>
          <p>Best regards,<br>FaceSight Attendance System</p>
        `,
      });
    });

    const results = await Promise.allSettled(emailPromises || []);
    const successful = results.filter(r => r.status === "fulfilled").length;
    
    console.log(`Sent ${successful} absent notifications`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: successful,
        total: absentStudents.length 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("Error sending absent notifications:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
};

serve(handler);
