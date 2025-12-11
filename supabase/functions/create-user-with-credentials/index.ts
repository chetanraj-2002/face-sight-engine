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
    const loginUrl = `${supabaseUrl.replace('.supabase.co', '.lovable.app')}/auth`;
    
    try {
      const roleDisplay = role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      
      const { data: emailData, error: emailError } = await resend.emails.send({
        from: "Face Recognition System <onboarding@resend.dev>",
        to: [email],
        subject: `Welcome! Your ${roleDisplay} Account is Ready`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="min-height: 100vh;">
              <tr>
                <td align="center" style="padding: 40px 20px;">
                  <table role="presentation" width="100%" style="max-width: 500px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <tr>
                      <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); border-radius: 12px 12px 0 0;">
                        <div style="width: 60px; height: 60px; background-color: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                          <span style="font-size: 28px;">👤</span>
                        </div>
                        <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Welcome Aboard!</h1>
                        <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Your account has been created successfully</p>
                      </td>
                    </tr>
                    
                    <!-- Body -->
                    <tr>
                      <td style="padding: 32px 40px;">
                        <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                          Hello <strong>${name}</strong>,
                        </p>
                        <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px; line-height: 1.6;">
                          You've been added as a <strong style="color: #3b82f6;">${roleDisplay}</strong> to the Face Recognition Attendance System. Here are your login credentials:
                        </p>
                        
                        <!-- Credentials Box -->
                        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                            <tr>
                              <td style="padding: 8px 0;">
                                <span style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Email</span>
                                <div style="color: #1f2937; font-size: 15px; font-weight: 500; margin-top: 4px; word-break: break-all;">${email}</div>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 16px 0 8px; border-top: 1px solid #e2e8f0; margin-top: 12px;">
                                <span style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Password</span>
                                <div style="background-color: #1f2937; color: #f9fafb; font-size: 15px; font-family: 'SF Mono', 'Fira Code', monospace; padding: 10px 14px; border-radius: 6px; margin-top: 6px; letter-spacing: 1px;">${password}</div>
                              </td>
                            </tr>
                          </table>
                        </div>
                        
                        <!-- Login Button -->
                        <a href="${loginUrl}" style="display: block; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: #ffffff; text-decoration: none; padding: 14px 24px; border-radius: 8px; font-size: 15px; font-weight: 600; text-align: center; margin-bottom: 24px;">
                          Login to Your Account →
                        </a>
                        
                        <!-- Security Notice -->
                        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 0 6px 6px 0;">
                          <p style="margin: 0; color: #92400e; font-size: 13px; line-height: 1.5;">
                            <strong>Security Tip:</strong> Please change your password after your first login to keep your account secure.
                          </p>
                        </div>
                      </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                      <td style="padding: 24px 40px; background-color: #f8fafc; border-radius: 0 0 12px 12px; border-top: 1px solid #e2e8f0;">
                        <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px; text-align: center;">
                          Need help? Contact your system administrator.
                        </p>
                        <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
                          Face Recognition Attendance System
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
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
