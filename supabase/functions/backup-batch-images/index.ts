import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { batchNumber, modelVersion } = await req.json();

    if (!batchNumber) {
      throw new Error('Missing batchNumber');
    }

    console.log(`Starting backup for batch ${batchNumber}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all images for the current batch (last N users)
    const { data: batchTracking } = await supabase
      .from('user_batch_tracking')
      .select('users_in_batch')
      .eq('batch_number', batchNumber)
      .single();

    const usersCount = batchTracking?.users_in_batch || 0;

    // Get latest users
    const { data: latestUsers } = await supabase
      .from('users')
      .select('id, usn')
      .order('created_at', { ascending: false })
      .limit(usersCount);

    if (!latestUsers || latestUsers.length === 0) {
      throw new Error('No users found for backup');
    }

    const userIds = latestUsers.map(u => u.id);

    // Get all images for these users
    const { data: images, error: imagesError } = await supabase
      .from('face_images')
      .select('*')
      .in('user_id', userIds);

    if (imagesError) throw imagesError;

    console.log(`Found ${images?.length || 0} images to backup`);

    // Copy images to backup bucket with batch folder structure
    let copiedCount = 0;
    for (const image of images || []) {
      const sourcePath = image.storage_path;
      const backupPath = `batch-${String(batchNumber).padStart(3, '0')}/${sourcePath}`;

      try {
        // Download from source
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('face-images')
          .download(sourcePath);

        if (downloadError) {
          console.error(`Failed to download ${sourcePath}:`, downloadError);
          continue;
        }

        // Upload to backup
        const { error: uploadError } = await supabase.storage
          .from('face-images-backup')
          .upload(backupPath, fileData, {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (uploadError) {
          console.error(`Failed to upload backup ${backupPath}:`, uploadError);
          continue;
        }

        copiedCount++;
      } catch (err) {
        console.error(`Error backing up ${sourcePath}:`, err);
      }
    }

    // Create backup record
    const { error: backupError } = await supabase
      .from('dataset_backups')
      .insert({
        batch_number: batchNumber,
        users_count: usersCount,
        images_count: copiedCount,
        backup_folder: `batch-${String(batchNumber).padStart(3, '0')}`,
        model_version: modelVersion || 'unknown',
      });

    if (backupError) throw backupError;

    console.log(`Backup complete: ${copiedCount} images backed up`);

    return new Response(
      JSON.stringify({
        success: true,
        batchNumber,
        usersCount,
        imagesBackedUp: copiedCount,
        backupFolder: `batch-${String(batchNumber).padStart(3, '0')}`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Backup error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
