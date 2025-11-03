import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Get the authenticated user making this request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Verify the user is a super admin
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (rolesError || !roles?.some(r => r.role === "super_admin")) {
      return new Response(
        JSON.stringify({ error: "Only super admins can delete institute admins" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get all institute admin users
    const { data: instituteAdmins, error: queryError } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "institute_admin");

    if (queryError) {
      console.error("Error querying institute admins:", queryError);
      throw queryError;
    }

    if (!instituteAdmins || instituteAdmins.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No institute administrators found",
          deleted_count: 0 
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Found ${instituteAdmins.length} institute admins to delete`);

    // Delete each user using admin API (this will cascade to profiles and user_roles)
    const deletePromises = instituteAdmins.map(admin => 
      supabaseAdmin.auth.admin.deleteUser(admin.user_id)
    );

    const results = await Promise.allSettled(deletePromises);
    
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failedCount = results.filter(r => r.status === 'rejected').length;

    console.log(`Deleted ${successCount} institute admins successfully`);
    if (failedCount > 0) {
      console.error(`Failed to delete ${failedCount} institute admins`);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Successfully deleted ${successCount} institute administrator(s)`,
        deleted_count: successCount,
        failed_count: failedCount
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in delete-institute-admins function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
