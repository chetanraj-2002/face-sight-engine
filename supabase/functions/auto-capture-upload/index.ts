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
    const { userId, usn, images } = await req.json();

    if (!userId || !usn || !images || images.length === 0) {
      throw new Error('Missing required fields: userId, usn, or images');
    }

    console.log(`Starting auto-capture upload for ${usn} with ${images.length} images`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Upload images sequentially to avoid rate limiting
    const uploadedFiles: string[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (let index = 0; index < images.length; index++) {
      try {
        const base64Image = images[index];
        // Remove data URL prefix if present
        const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        
        const fileName = `${usn}/${String(index).padStart(5, '0')}.jpg`;
        
        // Upload to storage with upsert to handle existing files
        const { error: uploadError } = await supabase.storage
          .from('face-images')
          .upload(fileName, imageBuffer, {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (uploadError) {
          console.error(`Upload error for ${fileName}:`, uploadError.message);
          errorCount++;
          continue;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('face-images')
          .getPublicUrl(fileName);

        // Check if record already exists
        const { data: existing } = await supabase
          .from('face_images')
          .select('id')
          .eq('storage_path', fileName)
          .single();

        if (existing) {
          // Update existing record
          await supabase
            .from('face_images')
            .update({ image_url: publicUrl })
            .eq('storage_path', fileName);
        } else {
          // Insert new record
          const { error: dbError } = await supabase
            .from('face_images')
            .insert({
              user_id: userId,
              usn: usn,
              image_url: publicUrl,
              storage_path: fileName,
            });

          if (dbError) {
            console.error(`DB error for ${fileName}:`, dbError.message);
            errorCount++;
            continue;
          }
        }

        uploadedFiles.push(fileName);
        successCount++;

        // Log progress every 20 images
        if ((index + 1) % 20 === 0) {
          console.log(`Progress: ${index + 1}/${images.length} images processed`);
        }
      } catch (imgError: any) {
        console.error(`Error processing image ${index}:`, imgError.message);
        errorCount++;
      }
    }

    console.log(`Upload complete: ${successCount} success, ${errorCount} errors`);

    // Update user's image_count
    const { error: updateError } = await supabase
      .from('users')
      .update({ image_count: successCount })
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating user image count:', updateError.message);
    }

    // Get current batch settings
    const { data: settings } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', ['batch_size', 'current_batch_number', 'users_in_current_batch']);

    const settingsMap = settings?.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {}) || {};
    const batchSize = parseInt(settingsMap['batch_size'] || '10');
    const currentBatch = parseInt(settingsMap['current_batch_number'] || '1');
    let usersInBatch = parseInt(settingsMap['users_in_current_batch'] || '0');

    // Increment user count
    usersInBatch++;

    // Update users_in_current_batch
    await supabase
      .from('system_settings')
      .update({ value: usersInBatch.toString() })
      .eq('key', 'users_in_current_batch');

    // Update or create batch tracking
    const { data: existingBatch } = await supabase
      .from('user_batch_tracking')
      .select('*')
      .eq('batch_number', currentBatch)
      .single();

    if (existingBatch) {
      await supabase
        .from('user_batch_tracking')
        .update({ users_in_batch: usersInBatch })
        .eq('batch_number', currentBatch);
    } else {
      await supabase
        .from('user_batch_tracking')
        .insert({
          batch_number: currentBatch,
          users_in_batch: usersInBatch,
          batch_status: 'collecting',
        });
    }

    // Check if batch is complete
    const batchComplete = usersInBatch >= batchSize;
    
    if (batchComplete) {
      console.log(`Batch ${currentBatch} complete! Triggering processing pipeline...`);
      
      // Trigger the processing pipeline (fire and forget)
      supabase.functions.invoke('process-pipeline', {
        body: { batchNumber: currentBatch }
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        imagesUploaded: successCount,
        errors: errorCount,
        usersInBatch,
        batchSize,
        batchComplete,
        message: batchComplete 
          ? `Batch ${currentBatch} complete! Processing started.`
          : `User added (${usersInBatch}/${batchSize}). Uploaded ${successCount}/${images.length} images.`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Auto-capture upload error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
