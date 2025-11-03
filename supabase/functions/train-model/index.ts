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
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
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

    // Trigger training on Python API
    const trainResponse = await fetch(`${normalizedUrl}/api/train/model`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

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

    // Poll for status updates
    let completed = false;
    let lastProgress = 0;
    const maxAttempts = 60; // 10 minutes max
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
                accuracy: status.accuracy,
                model_version: status.model_version,
                result_data: status.result || {},
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
            
            throw new Error(`Training failed: ${status.message}`);
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