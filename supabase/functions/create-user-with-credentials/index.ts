import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@4.0.0";

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

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const userExists = existingUsers?.users.some(user => user.email === email);

    if (userExists) {
      console.log("User already exists:", email);
      return new Response(
        JSON.stringify({ 
          error: "A user with this email already exists. Please use a different email address.",
          code: "user_exists"
        }),
        {
          status: 409,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

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

    const userId = authData.user.id;

    // Log role assignment to audit trail
    try {
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user: currentUser } } = await supabaseAdmin.auth.getUser(token);
        
        if (currentUser) {
          await supabaseAdmin.from('role_change_audit').insert({
            user_id: userId,
            performed_by: currentUser.id,
            action: 'assigned',
            role,
            institute,
            department,
            details: { email, name, created_via: 'edge_function' },
          });
          console.log("Role assignment logged to audit trail");
        }
      }
    } catch (auditError) {
      // Non-critical - log but don't fail the request
      console.error("Failed to log audit trail (non-critical):", auditError);
    }

    // Send credentials email using Resend
    let emailSent = false;
    try {
      const { data: emailData, error: emailError } = await resend.emails.send({
        from: "Face Recognition System <onboarding@resend.dev>",
        to: [email],
        subject: `Your ${role.replace('_', ' ').toUpperCase()} Account Credentials`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Welcome to Face Recognition System</h2>
            <p>Hello ${name},</p>
            <p>Your account has been created successfully with the role of <strong>${role.replace('_', ' ').toUpperCase()}</strong>.</p>
            
            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Your Login Credentials:</h3>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Password:</strong> <code style="background-color: #e0e0e0; padding: 2px 6px; border-radius: 3px;">${password}</code></p>
            </div>
            
            <p>Please keep these credentials secure and change your password after your first login.</p>
            <p>You can now log in to the system using these credentials.</p>
            
            <p style="margin-top: 30px; color: #666;">
              Best regards,<br>
              Face Recognition System Team
            </p>
          </div>
        `,
      });

      if (emailError) {
        console.error("Resend email error:", emailError);
      } else {
        console.log("Email sent successfully via Resend:", emailData);
        emailSent = true;
      }
    } catch (emailError: any) {
      console.error("Failed to send email (non-critical):", emailError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        userId: authData.user.id,
        email: authData.user.email,
        password: password,
        emailSent: emailSent
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
