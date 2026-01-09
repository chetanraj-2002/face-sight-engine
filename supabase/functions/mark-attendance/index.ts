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

    let pythonApiUrl = Deno.env.get('PYTHON_API_URL');
    if (!pythonApiUrl) {
      throw new Error('PYTHON_API_URL not configured');
    }
    
    // Clean up URL - remove any leading/trailing whitespace and ensure no double protocols
    pythonApiUrl = pythonApiUrl.trim();
    
    // If URL already has a protocol, use it as-is; otherwise add http://
    if (!pythonApiUrl.startsWith('http://') && !pythonApiUrl.startsWith('https://')) {
      pythonApiUrl = `https://${pythonApiUrl}`;
    }
    
    // Remove trailing slash if present
    pythonApiUrl = pythonApiUrl.replace(/\/+$/, '');

    const formData = await req.formData();
    const imageFile = formData.get('image') as File;
    const sessionId = formData.get('session_id') as string;

    if (!imageFile || !sessionId) {
      throw new Error('Missing required fields: image and session_id');
    }

    // Security: Validate file size (max 10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (imageFile.size > MAX_FILE_SIZE) {
      throw new Error('Image file too large. Maximum size is 10MB.');
    }

    // Security: Validate file type by checking magic bytes
    const arrayBufferForValidation = await imageFile.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBufferForValidation);
    
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

    // Security: Validate session_id format (accepts both UUID and timestamp-based session IDs)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const sessionIdRegex = /^session_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/;
    if (!uuidRegex.test(sessionId) && !sessionIdRegex.test(sessionId)) {
      throw new Error('Invalid session ID format.');
    }

    console.log('Processing attendance for session:', sessionId);

    // Verify session exists
    const { data: session, error: sessionError } = await supabaseClient
      .from('attendance_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    if (sessionError || !session) {
      throw new Error('Invalid session ID');
    }

    // Create FormData to send to Python API (it expects multipart/form-data)
    // Reuse the already-read array buffer for creating the blob
    const blob = new Blob([arrayBufferForValidation], { type: imageFile.type || 'image/jpeg' });
    
    const pythonFormData = new FormData();
    pythonFormData.append('image', blob, 'capture.jpg');
    pythonFormData.append('session_id', sessionId);
    pythonFormData.append('confidence_threshold', '0.6');

    // Send to Python API
    const attendanceResponse = await fetch(`${pythonApiUrl}/api/recognize/mark-attendance`, {
      method: 'POST',
      headers: {
        'ngrok-skip-browser-warning': 'true',
      },
      body: pythonFormData,
    });

    if (!attendanceResponse.ok) {
      const errorText = await attendanceResponse.text();
      throw new Error(`Attendance marking failed: ${errorText}`);
    }

    const result = await attendanceResponse.json();
    console.log('Attendance marked:', result);

    // Insert attendance logs - Python API returns 'attendees' not 'recognized'
    const attendanceLogs = (result.attendees || result.recognized || []).map((person: any) => ({
      session_id: sessionId,
      usn: person.usn,
      name: person.name,
      class: person.class || session.class_name,
      timestamp: new Date().toISOString(),
      confidence: person.confidence,
      image_url: result.image_url || '',
    }));

    if (attendanceLogs.length > 0) {
      const { error: logsError } = await supabaseClient
        .from('attendance_logs')
        .insert(attendanceLogs);

      if (logsError) {
        console.error('Failed to save attendance logs:', logsError);
      }
    }

    // Update session statistics
    const { data: totalMarked } = await supabaseClient
      .from('attendance_logs')
      .select('usn', { count: 'exact', head: false })
      .eq('session_id', sessionId);

    // Get unique students
    const uniqueStudents = new Set(totalMarked?.map((log: any) => log.usn) || []);

    await supabaseClient
      .from('attendance_sessions')
      .update({
        total_marked: uniqueStudents.size,
      })
      .eq('session_id', sessionId);

    return new Response(
      JSON.stringify({
        success: true,
        session_id: sessionId,
        marked_count: attendanceLogs.length,
        total_in_session: uniqueStudents.size,
        ...result,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in mark-attendance:', error);
    // Security: Sanitize error message - don't expose internal details
    const safeErrorMessages = [
      'Missing required fields: image and session_id',
      'Image file too large. Maximum size is 10MB.',
      'Invalid image format. Only JPEG, PNG, and WebP are allowed.',
      'Invalid session ID format.',
      'Invalid session ID',
    ];
    const errorMessage = safeErrorMessages.includes(error.message) 
      ? error.message 
      : 'An error occurred while processing attendance.';
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});