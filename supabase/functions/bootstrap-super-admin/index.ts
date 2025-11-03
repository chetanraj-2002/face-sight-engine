import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BootstrapRequest {
  email: string;
  name: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check if any super admin already exists
    const { data: existingAdmins } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('role', 'super_admin')
      .limit(1);

    if (existingAdmins && existingAdmins.length > 0) {
      return new Response(
        JSON.stringify({ error: "A super admin already exists. This function can only be used once." }),
        {
          status: 403,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const { email, name }: BootstrapRequest = await req.json();

    console.log("Creating first super admin:", { email, name });

    // Generate a random password
    const password = crypto.randomUUID().slice(0, 12);

    // Create user in auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role: 'super_admin'
      }
    });

    if (authError) {
      console.error("Auth error:", authError);
      throw authError;
    }

    console.log("Super admin created successfully:", authData.user.id);

    // Send credentials email using Resend (non-critical)
    let emailSent = false;
    try {
      const { data: emailData, error: emailError } = await resend.emails.send({
        from: "Face Recognition System <onboarding@resend.dev>",
        to: [email],
        subject: "Your Super Admin Account Credentials",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Welcome, Super Administrator!</h2>
            <p>Hello ${name},</p>
            <p>Your super admin account has been created successfully. You have full access to the Face Recognition System.</p>
            
            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Your Login Credentials:</h3>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Password:</strong> <code style="background-color: #e0e0e0; padding: 2px 6px; border-radius: 3px;">${password}</code></p>
            </div>
            
            <p><strong>Important:</strong> Please keep these credentials secure and change your password after your first login.</p>
            <p>As a super administrator, you have the highest level of access in the system.</p>
            
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
      // Continue anyway - credentials will be shown on screen
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
    console.error("Error in bootstrap-super-admin:", error);
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
