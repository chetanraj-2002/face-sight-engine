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

    const formData = await req.formData();
    const imageFile = formData.get('image') as File;

    if (!imageFile) {
      throw new Error('No image file provided');
    }

    // Security: Validate file size (max 10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (imageFile.size > MAX_FILE_SIZE) {
      throw new Error('Image file too large. Maximum size is 10MB.');
    }

    // Convert image to base64 and validate format
    const arrayBuffer = await imageFile.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Security: Validate file type by checking magic bytes
    const isValidImage = (
      // JPEG: FF D8 FF
      (uint8Array[0] === 0xFF && uint8Array[1] === 0xD8 && uint8Array[2] === 0xFF) ||
      // PNG: 89 50 4E 47
      (uint8Array[0] === 0x89 && uint8Array[1] === 0x50 && uint8Array[2] === 0x4E && uint8Array[3] === 0x47) ||
      // WebP: 52 49 46 46 ... 57 45 42 50
      (uint8Array[0] === 0x52 && uint8Array[1] === 0x49 && uint8Array[2] === 0x46 && uint8Array[3] === 0x46)
    );

    if (!isValidImage) {
      throw new Error('Invalid image format. Only JPEG, PNG, and WebP are allowed.');
    }

    console.log('Processing recognition request to:', normalizedUrl);

    const base64Image = btoa(String.fromCharCode(...uint8Array));

    // Send to Python API with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    let recognizeResponse;
    try {
      recognizeResponse = await fetch(`${normalizedUrl}/api/recognize/image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: base64Image,
        }),
        signal: controller.signal,
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw new Error(`Failed to connect to Python API at ${normalizedUrl}. Please ensure the server is running and accessible. Error: ${fetchError.message}`);
    }
    clearTimeout(timeoutId);

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
    // Security: Sanitize error message - don't expose internal details
    const safeErrorMessages = [
      'No image file provided',
      'Image file too large. Maximum size is 10MB.',
      'Invalid image format. Only JPEG, PNG, and WebP are allowed.',
    ];
    const errorMessage = safeErrorMessages.includes(error.message) 
      ? error.message 
      : 'An error occurred during face recognition.';
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});