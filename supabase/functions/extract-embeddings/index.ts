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

    console.log('Starting embedding extraction to:', normalizedUrl);

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

    // Verify required models exist
    console.log('Checking for required model files...');
    try {
      const modelCheckResponse = await fetch(`${normalizedUrl}/api/dataset/stats`, {
        method: 'GET',
        signal: AbortSignal.timeout(15000), // 15 second timeout for model check
      });

      if (!modelCheckResponse.ok) {
        throw new Error(`Model availability check failed with status ${modelCheckResponse.status}`);
      }

      const statsData = await modelCheckResponse.json();
      if (!statsData.total_users || statsData.total_users === 0) {
        throw new Error('No dataset found. Please sync dataset before extracting embeddings.');
      }
      console.log(`Dataset check passed: ${statsData.total_users} users, ${statsData.total_images} images found.`);
    } catch (modelError) {
      throw new Error(`Model/dataset check failed: ${modelError.message}`);
    }

    // Create training job record
    const { data: job, error: jobError } = await supabaseClient
      .from('training_jobs')
      .insert({
        job_type: 'extract_embeddings',
        status: 'in_progress',
        progress: 0,
      })
      .select()
      .single();

    if (jobError) {
      throw new Error(`Failed to create job: ${jobError.message}`);
    }

    console.log('Created job:', job.id);

    // Trigger embedding extraction on Python API with enhanced timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout for initial connection
    
    let extractResponse;
    try {
      extractResponse = await fetch(`${normalizedUrl}/api/train/extract-embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
        signal: controller.signal,
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      await supabaseClient
        .from('training_jobs')
        .update({
          status: 'failed',
          error_message: `Cannot connect to Python API: ${fetchError.message}`,
        })
        .eq('id', job.id);
      throw new Error(`Failed to connect to Python API at ${normalizedUrl}. Please ensure the server is running and accessible.`);
    }
    clearTimeout(timeoutId);

    if (!extractResponse.ok) {
      const errorText = await extractResponse.text();
      await supabaseClient
        .from('training_jobs')
        .update({
          status: 'failed',
          error_message: `Python API failed: ${errorText}`,
        })
        .eq('id', job.id);
      
      throw new Error(`Failed to start extraction: ${errorText}`);
    }

    // Poll for status updates
    let completed = false;
    let lastProgress = 0;
    const maxAttempts = 60; // 10 minutes max (10s intervals)
    let attempts = 0;

    while (!completed && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      attempts++;

      try {
        const statusResponse = await fetch(`${normalizedUrl}/api/train/status`);
        if (statusResponse.ok) {
          const status = await statusResponse.json();
          
          if (status.progress !== lastProgress) {
            lastProgress = status.progress;
            await supabaseClient
              .from('training_jobs')
              .update({
                progress: status.progress,
                logs: status.message || '',
              })
              .eq('id', job.id);
            
            console.log(`Progress: ${status.progress}%`);
          }

          if (status.status === 'completed') {
            completed = true;
            await supabaseClient
              .from('training_jobs')
              .update({
                status: 'completed',
                progress: 100,
                completed_at: new Date().toISOString(),
                embeddings_count: status.embeddings_count,
                users_processed: status.users_processed,
              })
              .eq('id', job.id);
          } else if (status.status === 'failed') {
            await supabaseClient
              .from('training_jobs')
              .update({
                status: 'failed',
                error_message: status.message,
              })
              .eq('id', job.id);
            
            throw new Error(`Extraction failed: ${status.message}`);
          }
        }
      } catch (pollError) {
        console.error('Error polling status:', pollError);
      }
    }

    if (!completed) {
      await supabaseClient
        .from('training_jobs')
        .update({
          status: 'failed',
          error_message: 'Extraction timed out',
        })
        .eq('id', job.id);
      
      throw new Error('Extraction timed out');
    }

    return new Response(
      JSON.stringify({
        success: true,
        job_id: job.id,
        message: 'Embeddings extracted successfully',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in extract-embeddings:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});