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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Upload all images
    const uploadPromises = images.map(async (base64Image: string, index: number) => {
      // Remove data URL prefix if present
      const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
      const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      
      const fileName = `${usn}/${String(index).padStart(5, '0')}.jpg`;
      
      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('face-images')
        .upload(fileName, imageBuffer, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('face-images')
        .getPublicUrl(fileName);

      // Save metadata
      const { error: dbError } = await supabase
        .from('face_images')
        .insert({
          user_id: userId,
          usn: usn,
          image_url: publicUrl,
          storage_path: fileName,
        });

      if (dbError) throw dbError;

      return fileName;
    });

    await Promise.all(uploadPromises);

    // Update user's image_count
    const { error: updateError } = await supabase
      .from('users')
      .update({ image_count: images.length })
      .eq('id', userId);

    if (updateError) throw updateError;

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
        imagesUploaded: images.length,
        usersInBatch,
        batchSize,
        batchComplete,
        message: batchComplete 
          ? `Batch ${currentBatch} complete! Processing started.`
          : `User added (${usersInBatch}/${batchSize})`
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
