import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useImageUpload() {
  const [uploading, setUploading] = useState(false);

  const uploadImages = async (userId: string, usn: string, files: File[]) => {
    setUploading(true);
    
    try {
      const uploadPromises = files.map(async (file, index) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${usn}/${String(index).padStart(5, '0')}.${fileExt}`;
        
        // Upload to Supabase Storage
        const { error: uploadError, data } = await supabase.storage
          .from("face-images")
          .upload(fileName, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from("face-images")
          .getPublicUrl(fileName);

        // Save metadata to database
        const { error: dbError } = await supabase
          .from("face_images")
          .insert({
            user_id: userId,
            usn: usn,
            image_url: publicUrl,
            storage_path: fileName,
          });

        if (dbError) throw dbError;

        return fileName;
      });

      await Promise.all(uploadPromises);

      // Update user's image_count
      const { error: updateError } = await supabase
        .from("users")
        .update({ image_count: files.length })
        .eq("id", userId);

      if (updateError) throw updateError;

    } catch (error: any) {
      console.error("Upload error:", error);
      throw error;
    } finally {
      setUploading(false);
    }
  };

  return {
    uploadImages,
    uploading,
  };
}
