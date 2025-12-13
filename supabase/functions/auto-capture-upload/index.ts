import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Process images in parallel batches for speed
const BATCH_SIZE = 10;

async function uploadImageBatch(
  supabase: any,
  images: string[],
  startIndex: number,
  userId: string,
  usn: string
): Promise<{ success: number; errors: number }> {
  const results = await Promise.all(
    images.map(async (base64Image, i) => {
      const index = startIndex + i;
      try {
        const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        const fileName = `${usn}/${String(index).padStart(5, '0')}.jpg`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('face-images')
          .upload(fileName, imageBuffer, {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (uploadError) {
          console.error(`Upload error ${fileName}:`, uploadError.message);
          return { success: false };
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('face-images')
          .getPublicUrl(fileName);

        // Upsert to database
        const { error: dbError } = await supabase
          .from('face_images')
          .upsert({
            user_id: userId,
            usn: usn,
            image_url: publicUrl,
            storage_path: fileName,
          }, { onConflict: 'storage_path' });

        if (dbError) {
          console.error(`DB error ${fileName}:`, dbError.message);
          return { success: false };
        }

        return { success: true };
      } catch (err: any) {
        console.error(`Error image ${index}:`, err.message);
        return { success: false };
      }
    })
  );

  return {
    success: results.filter(r => r.success).length,
    errors: results.filter(r => !r.success).length,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, usn, images } = await req.json();

    if (!userId || !usn || !images || images.length === 0) {
      throw new Error('Missing required fields: userId, usn, or images');
    }

    console.log(`Starting upload for ${usn}: ${images.length} images`);
    const startTime = Date.now();

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    let totalSuccess = 0;
    let totalErrors = 0;

    // Process in parallel batches
    for (let i = 0; i < images.length; i += BATCH_SIZE) {
      const batch = images.slice(i, i + BATCH_SIZE);
      const result = await uploadImageBatch(supabase, batch, i, userId, usn);
      totalSuccess += result.success;
      totalErrors += result.errors;
      
      if ((i + BATCH_SIZE) % 50 === 0 || i + BATCH_SIZE >= images.length) {
        console.log(`Progress: ${Math.min(i + BATCH_SIZE, images.length)}/${images.length}`);
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`Done: ${totalSuccess} ok, ${totalErrors} err in ${elapsed}s`);

    // Update user's image_count
    await supabase
      .from('users')
      .update({ image_count: totalSuccess })
      .eq('id', userId);

    // Update batch tracking for informational purposes only (no auto-trigger)
    const { data: settings } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', ['current_batch_number', 'users_in_current_batch']);

    const settingsMap = settings?.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {}) || {};
    const currentBatch = parseInt(settingsMap['current_batch_number'] || '1');
    let usersInBatch = parseInt(settingsMap['users_in_current_batch'] || '0') + 1;

    // Update users_in_current_batch
    await supabase
      .from('system_settings')
      .upsert({ key: 'users_in_current_batch', value: usersInBatch.toString() }, { onConflict: 'key' });

    // Upsert batch tracking (informational only)
    await supabase
      .from('user_batch_tracking')
      .upsert({
        batch_number: currentBatch,
        users_in_batch: usersInBatch,
        batch_status: 'collecting',
      }, { onConflict: 'batch_number' });

    return new Response(
      JSON.stringify({
        success: true,
        imagesUploaded: totalSuccess,
        errors: totalErrors,
        timeSeconds: parseFloat(elapsed),
        usersInBatch,
        message: `Uploaded ${totalSuccess} images in ${elapsed}s. Use Training page to sync dataset.`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Upload error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
