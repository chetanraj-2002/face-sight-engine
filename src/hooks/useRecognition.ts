import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_CONFIG, isDirectApiMode } from '@/config/api';
import { apiClient } from '@/lib/apiClient';

interface RecognitionResult {
  faces_detected: number;
  faces_recognized: number;
  results?: Array<{
    name: string;
    confidence: number;
    usn?: string;
    class?: string;
    bbox?: number[];
  }>;
}

export const useRecognition = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [recognitionResult, setRecognitionResult] = useState<RecognitionResult | null>(null);

  // Fetch recognition history
  const { data: history, isLoading } = useQuery({
    queryKey: ['recognition-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recognition_history')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    },
  });

  // Recognize faces mutation
  const recognizeFaces = useMutation({
    mutationFn: async (imageFile: File) => {
      const formData = new FormData();
      formData.append('image', imageFile);

      if (isDirectApiMode()) {
        // Direct API call to Python backend
        console.log('[Recognition] Using direct API for recognize-faces');
        const response = await apiClient.post<RecognitionResult>(
          API_CONFIG.ENDPOINTS.RECOGNIZE_IMAGE,
          formData
        );
        return response.data;
      } else {
        // Production: use edge function
        const { data, error } = await supabase.functions.invoke('recognize-faces', {
          body: formData,
        });
        if (error) throw error;
        return data as RecognitionResult;
      }
    },
    onSuccess: (data) => {
      if (data) {
        setRecognitionResult(data);
        toast({
          title: 'Recognition Complete',
          description: `Detected ${data.faces_detected} faces, recognized ${data.faces_recognized}`,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['recognition-history'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Recognition Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    history,
    isLoading,
    recognitionResult,
    recognizeFaces: recognizeFaces.mutate,
    isRecognizing: recognizeFaces.isPending,
    clearResult: () => setRecognitionResult(null),
  };
};
