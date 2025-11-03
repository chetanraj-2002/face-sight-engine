import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateUserRequest {
  email: string;
  name: string;
  usn?: string;
  department?: string;
  institute?: string;
  class?: string;
  role: 'super_admin' | 'institute_admin' | 'department_admin' | 'faculty' | 'student';
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { email, name, usn, department, institute, class: classValue, role }: CreateUserRequest = await req.json();

    console.log("Creating user:", { email, name, role });

    // Generate a random password
    const password = crypto.randomUUID().slice(0, 12);

    // Create user in auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        usn,
        department,
        institute,
        class: classValue,
        role
      }
    });

    if (authError) {
      console.error("Auth error:", authError);
      throw authError;
    }

    console.log("User created successfully:", authData.user.id);

    // Send credentials email
    const emailResponse = await resend.emails.send({
      from: "Face Recognition System <onboarding@resend.dev>",
      to: [email],
      subject: "Your Account Credentials",
      html: `
        <h1>Welcome to Face Recognition Attendance System!</h1>
        <p>Hello ${name},</p>
        <p>Your account has been created with the role: <strong>${role.replace('_', ' ').toUpperCase()}</strong></p>
        <h2>Your Login Credentials:</h2>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Password:</strong> ${password}</p>
        <p>Please login at: <a href="${supabaseUrl.replace('supabase.co', 'lovable.app')}">${supabaseUrl.replace('supabase.co', 'lovable.app')}</a></p>
        <p><strong>Important:</strong> Please change your password after your first login.</p>
        <br>
        <p>Best regards,<br>Face Recognition Attendance Team</p>
      `,
    });

    console.log("Email sent:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        userId: authData.user.id,
        email: authData.user.email 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in create-user-with-credentials:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
