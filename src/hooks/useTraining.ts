import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_CONFIG, isDirectApiMode } from '@/config/api';
import { apiClient } from '@/lib/apiClient';

interface TrainingResponse {
  success?: boolean;
  status?: string;
  message?: string;
  users_synced?: number;
  images_synced?: number;
  total_images?: number;
  embeddings_extracted?: number;
  accuracy?: number;
  job_id?: string;
  error?: string;
}

export const useTraining = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState(0);

  // Fetch training jobs
  const { data: trainingJobs, isLoading } = useQuery({
    queryKey: ['training-jobs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_jobs')
        .select('*')
        .order('started_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Get latest training status
  const latestJob = trainingJobs?.[0];

  // Sync dataset mutation - now uses faster URL-based sync
  const syncDataset = useMutation({
    mutationFn: async () => {
      if (isDirectApiMode()) {
        // Direct API call to Python backend using URL-based sync (faster!)
        console.log('[Training] Using direct API with URL-based sync (faster)');
        
        // Fetch users and their face images from Supabase
        const { data: users, error: usersError } = await supabase
          .from('users')
          .select('id, usn, name, class');
        
        if (usersError) throw usersError;
        
        const { data: faceImages, error: imagesError } = await supabase
          .from('face_images')
          .select('id, usn, user_id, image_url, storage_path');
        
        if (imagesError) throw imagesError;
        
        if (!users?.length || !faceImages?.length) {
          throw new Error('No users or images found. Please add users and upload face images first.');
        }
        
        // Prepare URL-based dataset (much faster - no base64 conversion!)
        const images: Array<{
          usn: string;
          name: string;
          class: string | null;
          url: string;
          filename: string;
        }> = [];
        
        for (const user of users) {
          const userImages = faceImages.filter(img => img.usn === user.usn);
          
          for (const img of userImages) {
            // Use the public URL directly - Python will download it
            images.push({
              usn: user.usn,
              name: user.name,
              class: user.class,
              url: img.image_url, // Public URL from Supabase Storage
              filename: img.storage_path.split('/').pop() || 'image.jpg',
            });
          }
        }
        
        const uniqueUsers = new Set(images.map(d => d.usn)).size;
        console.log(`[Training] Sending ${images.length} image URLs for ${uniqueUsers} users to Python API`);
        
        // Use the faster URL-based sync endpoint
        const response = await apiClient.post<TrainingResponse>(
          API_CONFIG.ENDPOINTS.SYNC_DATASET_URLS,
          { images }
        );
        return response.data;
      } else {
        // Production: use edge function
        const { data, error } = await supabase.functions.invoke('sync-dataset');
        if (error) throw error;
        return data;
      }
    },
    onSuccess: (data) => {
      toast({
        title: 'Dataset Synced',
        description: `Synced ${data?.users_synced || 0} users with ${data?.images_synced || 0} images`,
      });
      queryClient.invalidateQueries({ queryKey: ['training-jobs'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Sync Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Extract embeddings mutation
  const extractEmbeddings = useMutation({
    mutationFn: async () => {
      if (isDirectApiMode()) {
        // Direct API call to Python backend
        console.log('[Training] Using direct API for extract-embeddings');
        const response = await apiClient.post<TrainingResponse>(
          API_CONFIG.ENDPOINTS.EXTRACT_EMBEDDINGS
        );
        return response.data;
      } else {
        // Production: use edge function
        const { data, error } = await supabase.functions.invoke('extract-embeddings');
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      toast({
        title: 'Extraction Started',
        description: 'Face embeddings are being extracted',
      });
      queryClient.invalidateQueries({ queryKey: ['training-jobs'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Extraction Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Train model mutation
  const trainModel = useMutation({
    mutationFn: async () => {
      if (isDirectApiMode()) {
        // Direct API call to Python backend
        console.log('[Training] Using direct API for train-model');
        const response = await apiClient.post<TrainingResponse>(
          API_CONFIG.ENDPOINTS.TRAIN_MODEL
        );
        return response.data;
      } else {
        // Production: use edge function
        const { data, error } = await supabase.functions.invoke('train-model');
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      toast({
        title: 'Training Started',
        description: 'Model training is in progress',
      });
      queryClient.invalidateQueries({ queryKey: ['training-jobs'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Training Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Full pipeline - runs all 3 steps sequentially
  const [isRunningPipeline, setIsRunningPipeline] = useState(false);
  const [pipelineStep, setPipelineStep] = useState<string>('');

  const runFullPipeline = useCallback(async () => {
    setIsRunningPipeline(true);
    
    try {
      // Step 1: Sync Dataset using faster URL-based sync
      setPipelineStep('Syncing dataset...');
      toast({ title: 'Pipeline Started', description: 'Step 1/3: Syncing dataset to Python API...' });
      
      let syncResult: TrainingResponse;
      if (isDirectApiMode()) {
        console.log('[Pipeline] Step 1: Syncing dataset using URL-based sync (faster)...');
        
        const { data: users, error: usersError } = await supabase
          .from('users')
          .select('id, usn, name, class');
        
        if (usersError) throw new Error(`Failed to fetch users: ${usersError.message}`);
        
        const { data: faceImages, error: imagesError } = await supabase
          .from('face_images')
          .select('id, usn, user_id, image_url, storage_path');
        
        if (imagesError) throw new Error(`Failed to fetch images: ${imagesError.message}`);
        
        if (!users?.length || !faceImages?.length) {
          throw new Error('No users or images found. Please add users and upload face images first.');
        }
        
        // Use URL-based sync - no base64 conversion needed!
        const images: Array<{ usn: string; name: string; class: string | null; url: string; filename: string }> = [];
        
        for (const user of users) {
          const userImages = faceImages.filter(img => img.usn === user.usn);
          
          for (const img of userImages) {
            images.push({
              usn: user.usn,
              name: user.name,
              class: user.class,
              url: img.image_url, // Public URL - Python downloads directly
              filename: img.storage_path.split('/').pop() || 'image.jpg',
            });
          }
        }
        
        if (images.length === 0) {
          throw new Error('No images found. Please check your image uploads.');
        }
        
        console.log(`[Pipeline] Sending ${images.length} image URLs for ${new Set(images.map(d => d.usn)).size} users`);
        
        const response = await apiClient.post<TrainingResponse>(API_CONFIG.ENDPOINTS.SYNC_DATASET_URLS, { images });
        syncResult = response.data;
        
        if (!syncResult.success && syncResult.error) {
          throw new Error(`Sync failed: ${syncResult.error}`);
        }
      } else {
        const { data, error } = await supabase.functions.invoke('sync-dataset');
        if (error) throw error;
        syncResult = data;
      }
      
      console.log('[Pipeline] Sync completed:', syncResult);
      
      // Step 2: Extract Embeddings
      setPipelineStep('Extracting embeddings...');
      toast({ title: 'Step 2/3', description: 'Extracting face embeddings...' });
      
      // Wait a moment for the Python API to process
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      let extractResult: TrainingResponse;
      if (isDirectApiMode()) {
        console.log('[Pipeline] Step 2: Extracting embeddings...');
        const response = await apiClient.post<TrainingResponse>(API_CONFIG.ENDPOINTS.EXTRACT_EMBEDDINGS);
        extractResult = response.data;
        
        if (!extractResult.success && extractResult.error) {
          throw new Error(`Embedding extraction failed: ${extractResult.error}`);
        }
        
        if (extractResult.embeddings_extracted === 0) {
          throw new Error('No embeddings were extracted. Please check the dataset quality.');
        }
      } else {
        const { data, error } = await supabase.functions.invoke('extract-embeddings');
        if (error) throw error;
        extractResult = data;
      }
      
      console.log('[Pipeline] Extraction completed:', extractResult);
      
      // Step 3: Train Model
      setPipelineStep('Training model...');
      toast({ title: 'Step 3/3', description: 'Training the recognition model...' });
      
      // Wait for embeddings to be saved
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      let trainResult: TrainingResponse;
      if (isDirectApiMode()) {
        console.log('[Pipeline] Step 3: Training model...');
        const response = await apiClient.post<TrainingResponse>(API_CONFIG.ENDPOINTS.TRAIN_MODEL);
        trainResult = response.data;
        
        if (!trainResult.success && trainResult.error) {
          throw new Error(`Training failed: ${trainResult.error}`);
        }
      } else {
        const { data, error } = await supabase.functions.invoke('train-model');
        if (error) throw error;
        trainResult = data;
      }
      
      console.log('[Pipeline] Training completed:', trainResult);
      
      // Success!
      const accuracy = trainResult.accuracy ? `${(trainResult.accuracy * 100).toFixed(1)}%` : 'calculated';
      toast({
        title: 'Pipeline Complete! ✅',
        description: `Model trained successfully with ${accuracy} accuracy. Ready for recognition.`,
      });
      
      queryClient.invalidateQueries({ queryKey: ['training-jobs'] });
      
    } catch (error: any) {
      console.error('[Pipeline] Error:', error);
      toast({
        title: 'Pipeline Failed',
        description: error.message || 'An error occurred during training pipeline',
        variant: 'destructive',
      });
    } finally {
      setIsRunningPipeline(false);
      setPipelineStep('');
    }
  }, [toast, queryClient]);

  return {
    trainingJobs,
    latestJob,
    isLoading,
    progress: latestJob?.progress || 0,
    syncDataset: syncDataset.mutate,
    extractEmbeddings: extractEmbeddings.mutate,
    trainModel: trainModel.mutate,
    isSyncing: syncDataset.isPending,
    isExtracting: extractEmbeddings.isPending,
    isTraining: trainModel.isPending,
    // Full pipeline
    runFullPipeline,
    isRunningPipeline,
    pipelineStep,
  };
};
