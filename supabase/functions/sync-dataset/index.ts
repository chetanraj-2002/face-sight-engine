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

    // Pre-flight health check
    console.log('Performing health check on Python API...');
    try {
      const healthResponse = await fetch(`${normalizedUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000), // 10 second timeout for health check
      });

      if (!healthResponse.ok) {
        throw new Error(`Python API health check failed with status ${healthResponse.status}`);
      }

      const healthData = await healthResponse.json();
      console.log('Python API health check passed:', healthData);
    } catch (healthError) {
      throw new Error(`Python API health check failed. Please ensure the server is running and accessible at ${normalizedUrl}. Error: ${healthError.message}`);
    }

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
          guidance: [
            '1. Add users to the system',
            '2. Upload face images for each user',
            '3. Ensure images are stored in Supabase Storage',
            '4. Try the sync operation again'
          ],
          users_synced: 0,
          images_synced: 0,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Batch processing for large datasets
    const BATCH_SIZE = 1000;
    let finalResult: any = { users_synced: 0, images_synced: 0 };
    let batchesProcessed = 0;

    if (totalImagesSynced > BATCH_SIZE) {
      console.log(`Large dataset detected (${totalImagesSynced} images). Processing in batches of ${BATCH_SIZE}.`);

      // Process dataset in batches
      for (let i = 0; i < dataset.length; i += BATCH_SIZE) {
        const batch = dataset.slice(i, i + BATCH_SIZE);
        batchesProcessed++;
        console.log(`Processing batch ${batchesProcessed} (${batch.length} images)...`);

        // Enhanced timeout handling for batch processing
        const batchTimeoutMs = 300000; // 5 minutes per batch

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), batchTimeoutMs);

        let syncResponse;
        try {
          syncResponse = await fetch(`${normalizedUrl}/api/dataset/sync`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ dataset: batch }),
            signal: controller.signal,
          });
        } catch (fetchError) {
          clearTimeout(timeoutId);
          throw new Error(`Batch ${batchesProcessed} failed: ${fetchError.message}`);
        }
        clearTimeout(timeoutId);

        if (!syncResponse.ok) {
          const errorText = await syncResponse.text();
          throw new Error(`Batch ${batchesProcessed} failed: Python API returned ${syncResponse.status}: ${errorText}`);
        }

        const batchResult = await syncResponse.json();
        console.log(`Batch ${batchesProcessed} completed:`, batchResult);

        // Aggregate results
        finalResult.users_synced += batchResult.users_synced || 0;
        finalResult.images_synced += batchResult.images_synced || 0;
      }

      console.log(`All ${batchesProcessed} batches completed. Final result:`, finalResult);

      return new Response(
        JSON.stringify({
          success: true,
          users_synced: users?.length || 0,
          images_synced: totalImagesSynced,
          result: finalResult,
          batches_processed: batchesProcessed,
          batch_mode: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Enhanced timeout handling based on dataset size
    let timeoutMs = 300000; // Base 5 minutes
    if (totalImagesSynced > 1000) {
      timeoutMs = 600000; // 10 minutes for very large datasets
      console.log(`Large dataset detected (${totalImagesSynced} images). Extended timeout to ${timeoutMs / 60000} minutes.`);
    } else if (totalImagesSynced > 500) {
      timeoutMs = 450000; // 7.5 minutes for medium datasets
      console.log(`Medium dataset detected (${totalImagesSynced} images). Extended timeout to ${timeoutMs / 60000} minutes.`);
    }

    console.log(`Using ${timeoutMs / 60000} minute timeout for sync operation`);

    // Send to Python API with enhanced timeout and error handling (for non-batch mode)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
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

      // Provide specific error guidance based on error type
      let errorMessage = `Failed to connect to Python API at ${normalizedUrl}.`;
      let guidance = [
        '1. Ensure the Python API server is running',
        '2. Check that the PYTHON_API_URL environment variable is correct',
        '3. Verify network connectivity between Supabase and Python API',
        '4. Check firewall rules and port accessibility'
      ];

      if (fetchError.name === 'AbortError') {
        errorMessage = `Sync operation timed out after ${timeoutMs / 60000} minutes.`;
        guidance = [
          '1. Dataset may be too large - consider processing in smaller batches',
          '2. Check Python API server performance and resources',
          '3. Verify network stability',
          '4. Try the operation again'
        ];
      } else if (fetchError.code === 'ECONNREFUSED') {
        errorMessage = `Connection refused by Python API at ${normalizedUrl}.`;
        guidance = [
          '1. Ensure Python API server is running on the correct port',
          '2. Check that the server is not blocked by firewall',
          '3. Verify the URL is correct and accessible',
          '4. Restart the Python API server if needed'
        ];
      }

      throw new Error(errorMessage + '\n\nTroubleshooting steps:\n' + guidance.join('\n'));
    }
    clearTimeout(timeoutId);

    if (!syncResponse.ok) {
      const errorText = await syncResponse.text();

      // Provide specific error messages based on status code
      let errorMessage = `Python API sync failed`;
      let guidance = [];

      if (syncResponse.status === 400) {
        errorMessage = `Python API reported bad request`;
        guidance = [
          '1. Check if dataset format is correct',
          '2. Verify image data is valid base64',
          '3. Check for missing required fields in dataset'
        ];
      } else if (syncResponse.status === 500) {
        errorMessage = `Python API internal server error`;
        guidance = [
          '1. Check Python API server logs for details',
          '2. Verify server has sufficient disk space',
          '3. Check for memory issues on Python API server',
          '4. Restart the Python API server'
        ];
      } else if (syncResponse.status === 503) {
        errorMessage = `Python API service unavailable`;
        guidance = [
          '1. Python API server may be overloaded',
          '2. Wait and try again later',
          '3. Check server resources and restart if needed'
        ];
      }

      throw new Error(`${errorMessage}: ${errorText}\n\nTroubleshooting steps:\n${guidance.join('\n')}`);
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