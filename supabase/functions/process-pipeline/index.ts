import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function pollJobStatus(supabase: any, jobId: string, maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i++) {
    const { data: job } = await supabase
      .from('training_jobs')
      .select('status, error_message')
      .eq('id', jobId)
      .single();

    if (!job) throw new Error('Job not found');

    if (job.status === 'completed') {
      console.log(`Job ${jobId} completed successfully`);
      return true;
    } else if (job.status === 'failed') {
      throw new Error(`Job failed: ${job.error_message}`);
    }

    // Wait 5 seconds before next poll
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  throw new Error('Job polling timeout');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { batchNumber } = await req.json();

    if (!batchNumber) {
      throw new Error('Missing batchNumber');
    }

    console.log(`Starting processing pipeline for batch ${batchNumber}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Update batch status to processing
    await supabase
      .from('user_batch_tracking')
      .update({ batch_status: 'processing' })
      .eq('batch_number', batchNumber);

    console.log('Step 1/4: Syncing dataset to Python API...');
    
    // Step 1: Sync dataset
    const { data: syncResult, error: syncError } = await supabase.functions.invoke('sync-dataset');
    
    if (syncError) throw new Error(`Sync failed: ${syncError.message}`);
    console.log('Sync completed:', syncResult);

    // Wait before extraction
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('Step 2/4: Extracting embeddings...');
    
    // Step 2: Extract embeddings
    const { data: extractResult, error: extractError } = await supabase.functions.invoke('extract-embeddings');
    
    if (extractError) throw new Error(`Extraction failed: ${extractError.message}`);
    
    // Poll for extraction completion
    if (extractResult?.jobId) {
      await pollJobStatus(supabase, extractResult.jobId);
    }

    console.log('Step 3/4: Training model...');
    
    // Step 3: Train model
    const { data: trainResult, error: trainError } = await supabase.functions.invoke('train-model');
    
    if (trainError) throw new Error(`Training failed: ${trainError.message}`);
    
    // Poll for training completion
    if (trainResult?.jobId) {
      await pollJobStatus(supabase, trainResult.jobId);
    }

    // Get model version from training result
    const { data: latestJob } = await supabase
      .from('training_jobs')
      .select('model_version')
      .eq('id', trainResult?.jobId)
      .single();

    const modelVersion = latestJob?.model_version || 'unknown';

    console.log('Step 4/4: Backing up images...');
    
    // Step 4: Backup images
    const { data: backupResult, error: backupError } = await supabase.functions.invoke('backup-batch-images', {
      body: { batchNumber, modelVersion }
    });
    
    if (backupError) {
      console.error('Backup failed (non-fatal):', backupError);
    } else {
      console.log('Backup completed:', backupResult);
    }

    // Update batch as completed
    await supabase
      .from('user_batch_tracking')
      .update({ 
        batch_status: 'completed',
        completed_at: new Date().toISOString(),
        training_job_id: trainResult?.jobId
      })
      .eq('batch_number', batchNumber);

    // Reset for next batch
    const nextBatchNumber = batchNumber + 1;
    
    await supabase
      .from('system_settings')
      .update({ value: nextBatchNumber.toString() })
      .eq('key', 'current_batch_number');

    await supabase
      .from('system_settings')
      .update({ value: '0' })
      .eq('key', 'users_in_current_batch');

    // Create next batch tracking
    await supabase
      .from('user_batch_tracking')
      .insert({
        batch_number: nextBatchNumber,
        users_in_batch: 0,
        batch_status: 'collecting',
      });

    console.log(`Pipeline complete! Ready for batch ${nextBatchNumber}`);

    return new Response(
      JSON.stringify({
        success: true,
        batchNumber,
        nextBatchNumber,
        modelVersion,
        message: `Batch ${batchNumber} processed successfully. Ready for batch ${nextBatchNumber}.`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Pipeline error:', error);

    // Try to update batch status to failed
    try {
      const { batchNumber } = await req.json();
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      await supabase
        .from('user_batch_tracking')
        .update({ 
          batch_status: 'completed', // Reset to allow retry
          completed_at: new Date().toISOString()
        })
        .eq('batch_number', batchNumber);
    } catch (updateError) {
      console.error('Failed to update batch status:', updateError);
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
