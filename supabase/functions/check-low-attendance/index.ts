import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ATTENDANCE_THRESHOLD = 75; // Percentage threshold for low attendance warning

interface StudentAttendance {
  userId: string;
  email: string;
  name: string;
  className: string;
  totalClasses: number;
  attended: number;
  percentage: number;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting low attendance check...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body for optional class filter
    let targetClass: string | null = null;
    try {
      const body = await req.json();
      targetClass = body.class_name || null;
    } catch {
      // No body provided, check all classes
    }

    // Get all students with their profiles
    const { data: studentRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id, department")
      .eq("role", "student");

    if (rolesError) {
      console.error("Error fetching student roles:", rolesError);
      throw rolesError;
    }

    if (!studentRoles || studentRoles.length === 0) {
      console.log("No students found");
      return new Response(
        JSON.stringify({ message: "No students found", notifications_sent: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const studentIds = studentRoles.map((r) => r.user_id);

    // Get profiles for all students
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, name, email, class")
      .in("id", studentIds);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      throw profilesError;
    }

    // Get all completed sessions
    const { data: sessions, error: sessionsError } = await supabase
      .from("attendance_sessions")
      .select("session_id, class_name")
      .eq("status", "completed");

    if (sessionsError) {
      console.error("Error fetching sessions:", sessionsError);
      throw sessionsError;
    }

    // Get all attendance logs
    const { data: attendanceLogs, error: logsError } = await supabase
      .from("attendance_logs")
      .select("user_id, session_id");

    if (logsError) {
      console.error("Error fetching attendance logs:", logsError);
      throw logsError;
    }

    // Calculate attendance for each student
    const lowAttendanceStudents: StudentAttendance[] = [];

    for (const profile of profiles || []) {
      if (!profile.class || !profile.email) continue;
      
      // Filter by target class if specified
      if (targetClass && profile.class !== targetClass) continue;

      // Count total sessions for student's class
      const classSessions = sessions?.filter((s) => s.class_name === profile.class) || [];
      const totalClasses = classSessions.length;

      if (totalClasses === 0) continue;

      // Count attended sessions
      const studentAttendance = attendanceLogs?.filter((log) => log.user_id === profile.id) || [];
      const attended = studentAttendance.length;

      const percentage = (attended / totalClasses) * 100;

      console.log(`Student ${profile.name} (${profile.class}): ${attended}/${totalClasses} = ${percentage.toFixed(1)}%`);

      if (percentage < ATTENDANCE_THRESHOLD) {
        lowAttendanceStudents.push({
          userId: profile.id,
          email: profile.email,
          name: profile.name,
          className: profile.class,
          totalClasses,
          attended,
          percentage,
        });
      }
    }

    console.log(`Found ${lowAttendanceStudents.length} students with low attendance`);

    // Send email notifications
    let notificationsSent = 0;
    const errors: string[] = [];

    for (const student of lowAttendanceStudents) {
      try {
        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #ef4444, #dc2626); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
              .stats { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; border: 1px solid #e5e7eb; }
              .stat-row { display: flex; justify-content: space-between; margin: 8px 0; }
              .stat-label { color: #6b7280; }
              .stat-value { font-weight: bold; }
              .warning { color: #ef4444; font-weight: bold; font-size: 24px; }
              .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">⚠️ Low Attendance Alert</h1>
              </div>
              <div class="content">
                <p>Dear <strong>${student.name}</strong>,</p>
                
                <p>This is an automated notification to inform you that your attendance has dropped below the required threshold of <strong>${ATTENDANCE_THRESHOLD}%</strong>.</p>
                
                <div class="stats">
                  <div class="stat-row">
                    <span class="stat-label">Class:</span>
                    <span class="stat-value">${student.className}</span>
                  </div>
                  <div class="stat-row">
                    <span class="stat-label">Total Classes:</span>
                    <span class="stat-value">${student.totalClasses}</span>
                  </div>
                  <div class="stat-row">
                    <span class="stat-label">Classes Attended:</span>
                    <span class="stat-value">${student.attended}</span>
                  </div>
                  <div class="stat-row">
                    <span class="stat-label">Classes Missed:</span>
                    <span class="stat-value">${student.totalClasses - student.attended}</span>
                  </div>
                  <div class="stat-row">
                    <span class="stat-label">Current Attendance:</span>
                    <span class="warning">${student.percentage.toFixed(1)}%</span>
                  </div>
                </div>
                
                <p>Please ensure regular attendance to avoid academic consequences. If you have any concerns, please contact your department administrator.</p>
                
                <p>Best regards,<br>Attendance Management System</p>
              </div>
              <div class="footer">
                <p>This is an automated message. Please do not reply to this email.</p>
              </div>
            </div>
          </body>
          </html>
        `;

        const emailResponse = await resend.emails.send({
          from: "Attendance System <onboarding@resend.dev>",
          to: [student.email],
          subject: `⚠️ Low Attendance Alert - ${student.percentage.toFixed(1)}%`,
          html: emailHtml,
        });

        console.log(`Email sent to ${student.email}:`, emailResponse);
        notificationsSent++;
      } catch (emailError: any) {
        console.error(`Failed to send email to ${student.email}:`, emailError);
        errors.push(`${student.email}: ${emailError.message}`);
      }
    }

    // Log the notification event
    await supabase.from("audit_logs").insert({
      action: "low_attendance_notification",
      entity_type: "attendance",
      new_values: {
        students_notified: notificationsSent,
        threshold: ATTENDANCE_THRESHOLD,
        target_class: targetClass,
      },
    });

    console.log(`Low attendance check completed. Sent ${notificationsSent} notifications.`);

    return new Response(
      JSON.stringify({
        message: "Low attendance check completed",
        students_below_threshold: lowAttendanceStudents.length,
        notifications_sent: notificationsSent,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in check-low-attendance function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
