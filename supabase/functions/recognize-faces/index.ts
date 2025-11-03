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

    const formData = await req.formData();
    const imageFile = formData.get('image') as File;

    if (!imageFile) {
      throw new Error('No image file provided');
    }

    console.log('Processing recognition request...');

    // Convert image to base64
    const arrayBuffer = await imageFile.arrayBuffer();
    const base64Image = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    // Send to Python API
    const recognizeResponse = await fetch(`${pythonApiUrl}/api/recognize/image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: base64Image,
      }),
    });

    if (!recognizeResponse.ok) {
      const errorText = await recognizeResponse.text();
      throw new Error(`Recognition failed: ${errorText}`);
    }

    const result = await recognizeResponse.json();
    console.log('Recognition completed:', result);

    // Save to recognition_history
    const { error: historyError } = await supabaseClient
      .from('recognition_history')
      .insert({
        image_url: result.image_url || '',
        faces_detected: result.faces_detected || 0,
        faces_recognized: result.faces_recognized || 0,
        results: result.results || [],
      });

    if (historyError) {
      console.error('Failed to save history:', historyError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        ...result,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in recognize-faces:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});