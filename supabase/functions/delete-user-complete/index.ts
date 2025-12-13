import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DeleteUserRequest {
  userId: string; // auth user id
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { userId }: DeleteUserRequest = await req.json();
    
    if (!userId) {
      throw new Error("userId is required");
    }

    console.log("Deleting user completely:", userId);

    // 1. Get user profile to find USN
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('usn, name, email')
      .eq('id', userId)
      .single();

    console.log("Found profile:", profile);

    // 2. If user has USN, delete face images from storage and database
    if (profile?.usn) {
      // Get dataset user record
      const { data: datasetUser } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('usn', profile.usn)
        .single();

      if (datasetUser) {
        console.log("Found dataset user:", datasetUser.id);

        // Get all face images for this user
        const { data: faceImages } = await supabaseAdmin
          .from('face_images')
          .select('storage_path')
          .eq('user_id', datasetUser.id);

        // Delete images from storage
        if (faceImages && faceImages.length > 0) {
          const storagePaths = faceImages.map(img => img.storage_path);
          console.log("Deleting storage files:", storagePaths.length);
          
          const { error: storageError } = await supabaseAdmin.storage
            .from('face-images')
            .remove(storagePaths);

          if (storageError) {
            console.error("Storage deletion error:", storageError);
          }
        }

        // Delete face_images records
        const { error: faceImagesError } = await supabaseAdmin
          .from('face_images')
          .delete()
          .eq('user_id', datasetUser.id);

        if (faceImagesError) {
          console.error("Face images deletion error:", faceImagesError);
        }

        // Delete dataset user record
        const { error: datasetUserError } = await supabaseAdmin
          .from('users')
          .delete()
          .eq('id', datasetUser.id);

        if (datasetUserError) {
          console.error("Dataset user deletion error:", datasetUserError);
        }
      }
    }

    // 3. Delete user roles
    const { error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', userId);

    if (rolesError) {
      console.error("Roles deletion error:", rolesError);
    }

    // 4. Delete notification preferences
    const { error: notifError } = await supabaseAdmin
      .from('notification_preferences')
      .delete()
      .eq('user_id', userId);

    if (notifError) {
      console.error("Notification preferences deletion error:", notifError);
    }

    // 5. Delete profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (profileError) {
      console.error("Profile deletion error:", profileError);
    }

    // 6. Finally, delete auth user
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (authError) {
      console.error("Auth deletion error:", authError);
      throw authError;
    }

    // Log to audit
    try {
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user: currentUser } } = await supabaseAdmin.auth.getUser(token);
        
        if (currentUser) {
          await supabaseAdmin.from('audit_logs').insert({
            user_id: currentUser.id,
            action: 'delete',
            entity_type: 'user',
            entity_id: userId,
            old_values: { email: profile?.email, name: profile?.name, usn: profile?.usn },
          });
        }
      }
    } catch (auditError) {
      console.error("Audit log error (non-critical):", auditError);
    }

    console.log("User deleted successfully:", userId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "User and all associated data deleted successfully" 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in delete-user-complete:", error);
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
