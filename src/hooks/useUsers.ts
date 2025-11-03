import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface User {
  id: string;
  usn: string;
  name: string;
  class: string | null;
  image_count: number;
  created_at: string;
  updated_at: string;
  last_seen: string | null;
}

export function useUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalImages: 0,
  });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setUsers(data || []);
      
      // Calculate stats
      const totalImages = (data || []).reduce((sum, user) => sum + (user.image_count || 0), 0);
      setStats({
        totalUsers: data?.length || 0,
        totalImages,
      });
    } catch (error: any) {
      console.error("Error fetching users:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const addUser = async (userData: { usn: string; name: string; class: string }) => {
    const { data, error } = await supabase
      .from("users")
      .insert([{ 
        usn: userData.usn, 
        name: userData.name, 
        class: userData.class || null 
      }])
      .select()
      .single();

    if (error) throw error;

    await fetchUsers();
    return data.id;
  };

  const deleteUser = async (userId: string) => {
    // Get user's USN to delete images
    const user = users.find(u => u.id === userId);
    
    if (user) {
      // Delete images from storage
      const { data: images } = await supabase
        .from("face_images")
        .select("storage_path")
        .eq("user_id", userId);

      if (images && images.length > 0) {
        const paths = images.map(img => img.storage_path);
        await supabase.storage.from("face-images").remove(paths);
      }

      // Delete face_images records
      await supabase.from("face_images").delete().eq("user_id", userId);
    }

    // Delete user
    const { error } = await supabase
      .from("users")
      .delete()
      .eq("id", userId);

    if (error) throw error;

    await fetchUsers();
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return {
    users,
    loading,
    addUser,
    deleteUser,
    fetchUsers,
    stats,
  };
}
