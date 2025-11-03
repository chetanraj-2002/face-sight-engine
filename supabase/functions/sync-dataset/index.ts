import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const pythonApiUrl = Deno.env.get('PYTHON_API_URL');
    if (!pythonApiUrl) {
      throw new Error('PYTHON_API_URL not configured');
    }

    // Normalize URL - add http:// if no protocol specified
    const normalizedUrl = pythonApiUrl.startsWith('http://') || pythonApiUrl.startsWith('https://') 
      ? pythonApiUrl 
      : `http://${pythonApiUrl}`;

    console.log('Starting dataset sync to:', normalizedUrl);

    // Fetch all users from Supabase
    const { data: users, error: usersError } = await supabaseClient
      .from('users')
      .select('*');

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }

    console.log(`Found ${users?.length || 0} users`);

    // Fetch all face images
    const { data: faceImages, error: imagesError } = await supabaseClient
      .from('face_images')
      .select('*');

    if (imagesError) {
      throw new Error(`Failed to fetch face images: ${imagesError.message}`);
    }

    console.log(`Found ${faceImages?.length || 0} face images`);

    // Group images by USN
    const imagesByUsn: Record<string, any[]> = {};
    for (const img of faceImages || []) {
      if (!imagesByUsn[img.usn]) {
        imagesByUsn[img.usn] = [];
      }
      imagesByUsn[img.usn].push(img);
    }

    // Prepare dataset for Python API
    const dataset: any[] = [];
    let totalImagesSynced = 0;

    for (const user of users || []) {
      const userImages = imagesByUsn[user.usn] || [];
      
      for (const img of userImages) {
        try {
          // Download image from Supabase Storage
          const { data: imageData, error: downloadError } = await supabaseClient
            .storage
            .from('face-images')
            .download(img.storage_path);

          if (downloadError) {
            console.error(`Failed to download image ${img.storage_path}:`, downloadError);
            continue;
          }

          // Convert to base64
          const arrayBuffer = await imageData.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

          dataset.push({
            usn: user.usn,
            name: user.name,
            class: user.class,
            image: base64,
            filename: img.storage_path.split('/').pop(),
          });

          totalImagesSynced++;
        } catch (error) {
          console.error(`Error processing image for ${user.usn}:`, error);
        }
      }
    }

    console.log(`Prepared ${totalImagesSynced} images for sync`);

    // Check if there's any data to sync
    if (totalImagesSynced === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No images to sync. Please add users and upload face images first.',
          users_synced: 0,
          images_synced: 0,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send to Python API with timeout and better error handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout for large datasets
    
    let syncResponse;
    try {
      syncResponse = await fetch(`${normalizedUrl}/api/dataset/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dataset }),
        signal: controller.signal,
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw new Error(`Failed to connect to Python API at ${normalizedUrl}. Please ensure the server is running and accessible. Error: ${fetchError.message}`);
    }
    clearTimeout(timeoutId);

    if (!syncResponse.ok) {
      const errorText = await syncResponse.text();
      throw new Error(`Python API sync failed: ${errorText}`);
    }

    const result = await syncResponse.json();
    console.log('Sync completed:', result);

    return new Response(
      JSON.stringify({
        success: true,
        users_synced: users?.length || 0,
        images_synced: totalImagesSynced,
        result,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in sync-dataset:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});