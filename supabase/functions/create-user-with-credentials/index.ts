import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EMAILJS_SERVICE_ID = Deno.env.get("EMAILJS_SERVICE_ID");
const EMAILJS_TEMPLATE_ID = Deno.env.get("EMAILJS_TEMPLATE_ID_CREDENTIALS");
const EMAILJS_PUBLIC_KEY = Deno.env.get("EMAILJS_PUBLIC_KEY");

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

    // Send credentials email
    let emailSent = false;
    try {
      const emailResponse = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          service_id: EMAILJS_SERVICE_ID,
          template_id: EMAILJS_TEMPLATE_ID,
          user_id: EMAILJS_PUBLIC_KEY,
          template_params: {
            to_email: email,
            to_name: name,
            user_email: email,
            user_password: password,
            role: role.replace('_', ' ').toUpperCase(),
          },
        }),
      });

      if (emailResponse.ok) {
        console.log("Email sent successfully via EmailJS");
        emailSent = true;
      } else {
        const errorText = await emailResponse.text();
        console.error("EmailJS error:", errorText);
      }
    } catch (emailError: any) {
      console.error("Failed to send email (non-critical):", emailError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        userId: authData.user.id,
        email: authData.user.email,
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
