import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
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

    const formData = await req.formData();
    const imageFile = formData.get('image') as File;
    const sessionId = formData.get('session_id') as string;

    if (!imageFile || !sessionId) {
      throw new Error('Missing required fields: image and session_id');
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

    // Convert image to base64 safely (avoid stack overflow with large images)
    const arrayBuffer = await imageFile.arrayBuffer();
    const base64Image = base64Encode(new Uint8Array(arrayBuffer));

    // Send to Python API
    const attendanceResponse = await fetch(`${pythonApiUrl}/api/recognize/mark-attendance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: base64Image,
        session_id: sessionId,
      }),
    });

    if (!attendanceResponse.ok) {
      const errorText = await attendanceResponse.text();
      throw new Error(`Attendance marking failed: ${errorText}`);
    }

    const result = await attendanceResponse.json();
    console.log('Attendance marked:', result);

    // Insert attendance logs
    const attendanceLogs = (result.recognized || []).map((person: any) => ({
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
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});