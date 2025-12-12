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

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  let jobId: string | null = null;

  try {
    const pythonApiUrl = Deno.env.get('PYTHON_API_URL');
    if (!pythonApiUrl) {
      throw new Error('PYTHON_API_URL not configured');
    }

    const normalizedUrl = pythonApiUrl.startsWith('http://') || pythonApiUrl.startsWith('https://') 
      ? pythonApiUrl 
      : `http://${pythonApiUrl}`;

    console.log('Starting dataset sync to:', normalizedUrl);

    // Create a training job to track progress
    const { data: job, error: jobError } = await supabaseClient
      .from('training_jobs')
      .insert({
        job_type: 'dataset_sync',
        status: 'in_progress',
        progress: 0,
        logs: 'Starting dataset sync...',
      })
      .select()
      .single();

    if (jobError) {
      console.error('Failed to create tracking job:', jobError);
    } else {
      jobId = job.id;
      console.log('Created tracking job:', jobId);
    }

    // Helper to update progress
    const updateProgress = async (progress: number, logs: string) => {
      if (!jobId) return;
      await supabaseClient
        .from('training_jobs')
        .update({ progress, logs })
        .eq('id', jobId);
    };

    await updateProgress(5, 'Fetching users from database...');

    // Fetch all users from Supabase
    const { data: users, error: usersError } = await supabaseClient
      .from('users')
      .select('*');

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }

    console.log(`Found ${users?.length || 0} users`);
    await updateProgress(10, `Found ${users?.length || 0} users. Fetching face images...`);

    // Fetch all face images
    const { data: faceImages, error: imagesError } = await supabaseClient
      .from('face_images')
      .select('*');

    if (imagesError) {
      throw new Error(`Failed to fetch face images: ${imagesError.message}`);
    }

    console.log(`Found ${faceImages?.length || 0} face images`);
    await updateProgress(15, `Found ${faceImages?.length || 0} face images. Preparing download...`);

    // Group images by USN
    const imagesByUsn: Record<string, any[]> = {};
    for (const img of faceImages || []) {
      if (!imagesByUsn[img.usn]) {
        imagesByUsn[img.usn] = [];
      }
      imagesByUsn[img.usn].push(img);
    }

    const totalImages = faceImages?.length || 0;
    let processedImages = 0;

    console.log('Downloading images in parallel batches...');
    const startTime = Date.now();

    // Prepare dataset for Python API - process in parallel
    const dataset: any[] = [];
    const DOWNLOAD_BATCH_SIZE = 20;

    for (const user of users || []) {
      const userImages = imagesByUsn[user.usn] || [];
      
      // Process user images in parallel batches
      for (let i = 0; i < userImages.length; i += DOWNLOAD_BATCH_SIZE) {
        const batch = userImages.slice(i, i + DOWNLOAD_BATCH_SIZE);
        
        const results = await Promise.all(
          batch.map(async (img) => {
            try {
              const { data: imageData, error: downloadError } = await supabaseClient
                .storage
                .from('face-images')
                .download(img.storage_path);

              if (downloadError) {
                console.error(`Download failed ${img.storage_path}:`, downloadError.message);
                return null;
              }

              const arrayBuffer = await imageData.arrayBuffer();
              const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

              return {
                usn: user.usn,
                name: user.name,
                class: user.class,
                image: base64,
                filename: img.storage_path.split('/').pop(),
              };
            } catch (error: any) {
              console.error(`Error ${img.storage_path}:`, error.message);
              return null;
            }
          })
        );

        const validResults = results.filter(r => r !== null);
        dataset.push(...validResults);
        processedImages += batch.length;

        // Update progress (15-70% for downloads)
        const downloadProgress = 15 + Math.round((processedImages / totalImages) * 55);
        await updateProgress(
          Math.min(downloadProgress, 70),
          `Downloaded ${processedImages}/${totalImages} images...`
        );
      }
    }

    const totalImagesSynced = dataset.length;
    const downloadTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`Downloaded ${totalImagesSynced} images in ${downloadTime}s`);

    await updateProgress(70, `Downloaded ${totalImagesSynced} images in ${downloadTime}s. Syncing to Python API...`);

    // Check if there's any data to sync
    if (totalImagesSynced === 0) {
      await supabaseClient
        .from('training_jobs')
        .update({
          status: 'failed',
          progress: 100,
          error_message: 'No images to sync',
          completed_at: new Date().toISOString(),
          logs: 'No images to sync. Please add users and upload face images first.',
        })
        .eq('id', jobId);

      return new Response(
        JSON.stringify({
          success: false,
          error: 'No images to sync. Please add users and upload face images first.',
          users_synced: 0,
          images_synced: 0,
          job_id: jobId,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send to Python API with timeout and better error handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout
    
    await updateProgress(75, 'Sending dataset to Python API...');

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

    await updateProgress(95, 'Sync completed. Finalizing...');

    // Update job as completed
    await supabaseClient
      .from('training_jobs')
      .update({
        status: 'completed',
        progress: 100,
        completed_at: new Date().toISOString(),
        users_processed: users?.length || 0,
        embeddings_count: totalImagesSynced,
        logs: `Sync completed successfully. ${users?.length || 0} users, ${totalImagesSynced} images synced in ${downloadTime}s.`,
      })
      .eq('id', jobId);

    return new Response(
      JSON.stringify({
        success: true,
        users_synced: users?.length || 0,
        images_synced: totalImagesSynced,
        job_id: jobId,
        result,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in sync-dataset:', error);

    // Update job as failed
    if (jobId) {
      await supabaseClient
        .from('training_jobs')
        .update({
          status: 'failed',
          progress: 100,
          error_message: error.message,
          completed_at: new Date().toISOString(),
          logs: `Sync failed: ${error.message}`,
        })
        .eq('id', jobId);
    }

    return new Response(
      JSON.stringify({ error: error.message, job_id: jobId }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
