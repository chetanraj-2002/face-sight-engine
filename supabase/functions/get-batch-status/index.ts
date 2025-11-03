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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get current batch settings
    const { data: settings, error: settingsError } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', ['batch_size', 'current_batch_number', 'users_in_current_batch']);

    if (settingsError) throw settingsError;

    const settingsMap = settings?.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {}) || {};
    const batchSize = parseInt(settingsMap['batch_size'] || '10');
    const currentBatch = parseInt(settingsMap['current_batch_number'] || '1');
    const usersInBatch = parseInt(settingsMap['users_in_current_batch'] || '0');

    // Get current batch tracking
    const { data: batchTracking, error: batchError } = await supabase
      .from('user_batch_tracking')
      .select('*')
      .eq('batch_number', currentBatch)
      .single();

    const status = batchTracking?.batch_status || 'collecting';
    const usersRemaining = Math.max(0, batchSize - usersInBatch);

    // Determine processing stage if processing
    let processingStage = null;
    let message = '';

    if (status === 'collecting') {
      message = usersRemaining > 0 
        ? `Waiting for ${usersRemaining} more user${usersRemaining > 1 ? 's' : ''} to start training...`
        : 'Ready to start processing...';
    } else if (status === 'processing') {
      // Get latest training job
      const { data: latestJob } = await supabase
        .from('training_jobs')
        .select('job_type, status')
        .eq('id', batchTracking?.training_job_id || '')
        .single();

      if (latestJob) {
        if (latestJob.job_type === 'sync') processingStage = 'sync';
        else if (latestJob.job_type === 'extract') processingStage = 'extract';
        else if (latestJob.job_type === 'train') processingStage = 'train';
        else processingStage = 'backup';
      }
      message = `Processing batch ${currentBatch}... ${processingStage || 'Starting'}`;
    } else if (status === 'completed') {
      message = `Batch ${currentBatch} complete! Model trained successfully.`;
    }

    return new Response(
      JSON.stringify({
        currentBatch,
        usersInBatch,
        batchSize,
        status,
        usersRemaining,
        processingStage,
        message,
        batchTracking
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error getting batch status:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
