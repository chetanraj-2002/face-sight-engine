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

    console.log('Starting model training to:', normalizedUrl);

    // Embeddings validation before training
    console.log('Validating embeddings...');
    try {
      const embeddingsCheckResponse = await fetch(`${normalizedUrl}/api/train/status`, {
        method: 'GET',
        signal: AbortSignal.timeout(15000), // 15 second timeout for embeddings check
      });

      if (!embeddingsCheckResponse.ok) {
        throw new Error(`Failed to check embeddings status: ${embeddingsCheckResponse.status}`);
      }

      const embeddingsStatus = await embeddingsCheckResponse.json();

      // Check if embeddings exist and are valid
      if (!embeddingsStatus.embeddings_count || embeddingsStatus.embeddings_count === 0) {
        throw new Error('No embeddings found. Please extract embeddings before training the model.');
      }

      if (embeddingsStatus.embeddings_count < 10) {
        throw new Error(`Insufficient embeddings for training: only ${embeddingsStatus.embeddings_count} embeddings found. Minimum 10 embeddings required.`);
      }

      if (!embeddingsStatus.users_count || embeddingsStatus.users_count < 2) {
        throw new Error(`Insufficient users for training: only ${embeddingsStatus.users_count} users found. Minimum 2 users required.`);
      }

      console.log(`Embeddings validation passed: ${embeddingsStatus.embeddings_count} embeddings from ${embeddingsStatus.users_count} users`);
    } catch (validationError) {
      throw new Error(`Embeddings validation failed: ${validationError.message}`);
    }

    // Create training job record
    const { data: job, error: jobError } = await supabaseClient
      .from('training_jobs')
      .insert({
        job_type: 'train_model',
        status: 'in_progress',
        progress: 0,
      })
      .select()
      .single();

    if (jobError) {
      throw new Error(`Failed to create job: ${jobError.message}`);
    }

    console.log('Created job:', job.id);

    // Trigger training on Python API with enhanced timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout for training start
    
    let trainResponse;
    try {
      trainResponse = await fetch(`${normalizedUrl}/api/train/model`, {
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

    if (!trainResponse.ok) {
      const errorText = await trainResponse.text();
      await supabaseClient
        .from('training_jobs')
        .update({
          status: 'failed',
          error_message: `Python API failed: ${errorText}`,
        })
        .eq('id', job.id);
      
      throw new Error(`Failed to start training: ${errorText}`);
    }

    // Enhanced status polling with training stage tracking
    let completed = false;
    let lastProgress = 0;
    let lastStatus = '';
    let startTime = Date.now();
    const maxAttempts = 120; // 20 minutes max with 10s intervals
    let attempts = 0;

    while (!completed && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      attempts++;

      try {
        const statusResponse = await fetch(`${normalizedUrl}/api/train/status`, {
          signal: AbortSignal.timeout(15000), // 15 second timeout for status checks
        });

        if (statusResponse.ok) {
          const status = await statusResponse.json();

          // Enhanced progress tracking with specific training stages
          if (status.progress !== lastProgress || status.message !== lastStatus) {
            lastProgress = status.progress;
            lastStatus = status.message;

            // Calculate estimated time remaining
            const elapsedMs = Date.now() - startTime;
            const estimatedTotalMs = elapsedMs / (status.progress / 100);
            const estimatedRemainingMs = estimatedTotalMs - elapsedMs;
            const estimatedRemainingMinutes = Math.round(estimatedRemainingMs / 60000);

            await supabaseClient
              .from('training_jobs')
              .update({
                progress: status.progress,
                logs: `${status.message}${status.progress > 0 && status.progress < 100 ? ` (Est. ${estimatedRemainingMinutes} min remaining)` : ''}`,
              })
              .eq('id', job.id);

            console.log(`Training Progress: ${status.progress}% - ${status.message}`);
          }

          if (status.status === 'completed') {
            completed = true;
            await supabaseClient
              .from('training_jobs')
              .update({
                status: 'completed',
                progress: 100,
                completed_at: new Date().toISOString(),
                accuracy: status.accuracy,
                model_version: status.model_version,
                result_data: {
                  embeddings_count: status.embeddings_count,
                  users_processed: status.users_processed,
                  accuracy: status.accuracy,
                  model_version: status.model_version,
                  message: status.message
                },
                logs: `Training completed successfully. Model version: ${status.model_version}, Accuracy: ${status.accuracy}`,
              })
              .eq('id', job.id);

            console.log(`Training completed successfully. Model version: ${status.model_version}, Accuracy: ${status.accuracy}`);
          } else if (status.status === 'failed') {
            await supabaseClient
              .from('training_jobs')
              .update({
                status: 'failed',
                error_message: status.message,
                completed_at: new Date().toISOString(),
              })
              .eq('id', job.id);

            throw new Error(`Training failed: ${status.message}`);
          }
        } else {
          console.warn(`Status check failed with status ${statusResponse.status}`);
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
          error_message: 'Training timed out',
        })
        .eq('id', job.id);
      
      throw new Error('Training timed out');
    }

    return new Response(
      JSON.stringify({
        success: true,
        job_id: job.id,
        message: 'Model trained successfully',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in train-model:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});