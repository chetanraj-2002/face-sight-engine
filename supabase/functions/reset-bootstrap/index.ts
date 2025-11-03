import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Resetting bootstrap - deleting existing super admins");

    // Get all super admin user IDs
    const { data: superAdminRoles } = await supabaseAdmin
      .from('user_roles')
      .select('user_id')
      .eq('role', 'super_admin');

    if (!superAdminRoles || superAdminRoles.length === 0) {
      return new Response(
        JSON.stringify({ message: "No super admins found to delete" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Delete each super admin user
    for (const role of superAdminRoles) {
      console.log("Deleting super admin:", role.user_id);
      
      // Delete from auth (this will cascade to profiles and user_roles)
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
        role.user_id
      );

      if (deleteError) {
        console.error("Error deleting user:", deleteError);
      }
    }

    console.log("Bootstrap reset complete");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Deleted ${superAdminRoles.length} super admin(s). You can now create a new one.`,
        deleted_count: superAdminRoles.length
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in reset-bootstrap:", error);
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
