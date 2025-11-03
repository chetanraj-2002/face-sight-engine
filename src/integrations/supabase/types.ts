export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      attendance_logs: {
        Row: {
          class: string | null
          confidence: number
          created_at: string | null
          id: string
          image_url: string | null
          name: string
          session_id: string
          timestamp: string
          user_id: string | null
          usn: string
        }
        Insert: {
          class?: string | null
          confidence: number
          created_at?: string | null
          id?: string
          image_url?: string | null
          name: string
          session_id: string
          timestamp: string
          user_id?: string | null
          usn: string
        }
        Update: {
          class?: string | null
          confidence?: number
          created_at?: string | null
          id?: string
          image_url?: string | null
          name?: string
          session_id?: string
          timestamp?: string
          user_id?: string | null
          usn?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_sessions: {
        Row: {
          class_name: string
          created_at: string
          ended_at: string | null
          id: string
          session_id: string
          started_at: string
          status: string
          subject: string | null
          total_marked: number
          total_students: number
          updated_at: string
        }
        Insert: {
          class_name: string
          created_at?: string
          ended_at?: string | null
          id?: string
          session_id: string
          started_at?: string
          status?: string
          subject?: string | null
          total_marked?: number
          total_students?: number
          updated_at?: string
        }
        Update: {
          class_name?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          session_id?: string
          started_at?: string
          status?: string
          subject?: string | null
          total_marked?: number
          total_students?: number
          updated_at?: string
        }
        Relationships: []
      }
      face_images: {
        Row: {
          id: string
          image_url: string
          storage_path: string
          uploaded_at: string | null
          user_id: string | null
          usn: string
        }
        Insert: {
          id?: string
          image_url: string
          storage_path: string
          uploaded_at?: string | null
          user_id?: string | null
          usn: string
        }
        Update: {
          id?: string
          image_url?: string
          storage_path?: string
          uploaded_at?: string | null
          user_id?: string | null
          usn?: string
        }
        Relationships: [
          {
            foreignKeyName: "face_images_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          class: string | null
          created_at: string | null
          department: string | null
          email: string | null
          id: string
          institute: string | null
          name: string
          updated_at: string | null
          usn: string | null
        }
        Insert: {
          class?: string | null
          created_at?: string | null
          department?: string | null
          email?: string | null
          id: string
          institute?: string | null
          name: string
          updated_at?: string | null
          usn?: string | null
        }
        Update: {
          class?: string | null
          created_at?: string | null
          department?: string | null
          email?: string | null
          id?: string
          institute?: string | null
          name?: string
          updated_at?: string | null
          usn?: string | null
        }
        Relationships: []
      }
      recognition_history: {
        Row: {
          faces_detected: number | null
          faces_recognized: number | null
          id: string
          image_url: string
          results: Json | null
          timestamp: string | null
        }
        Insert: {
          faces_detected?: number | null
          faces_recognized?: number | null
          id?: string
          image_url: string
          results?: Json | null
          timestamp?: string | null
        }
        Update: {
          faces_detected?: number | null
          faces_recognized?: number | null
          id?: string
          image_url?: string
          results?: Json | null
          timestamp?: string | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          id: string
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      training_jobs: {
        Row: {
          accuracy: number | null
          completed_at: string | null
          embeddings_count: number | null
          error_message: string | null
          id: string
          job_type: string
          logs: string | null
          model_version: string | null
          progress: number | null
          result_data: Json | null
          started_at: string | null
          status: string
          users_processed: number | null
        }
        Insert: {
          accuracy?: number | null
          completed_at?: string | null
          embeddings_count?: number | null
          error_message?: string | null
          id?: string
          job_type: string
          logs?: string | null
          model_version?: string | null
          progress?: number | null
          result_data?: Json | null
          started_at?: string | null
          status?: string
          users_processed?: number | null
        }
        Update: {
          accuracy?: number | null
          completed_at?: string | null
          embeddings_count?: number | null
          error_message?: string | null
          id?: string
          job_type?: string
          logs?: string | null
          model_version?: string | null
          progress?: number | null
          result_data?: Json | null
          started_at?: string | null
          status?: string
          users_processed?: number | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          department: string | null
          id: string
          institute: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          department?: string | null
          id?: string
          institute?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          department?: string | null
          id?: string
          institute?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          class: string | null
          created_at: string | null
          id: string
          image_count: number | null
          last_seen: string | null
          name: string
          profile_id: string | null
          updated_at: string | null
          usn: string
        }
        Insert: {
          class?: string | null
          created_at?: string | null
          id?: string
          image_count?: number | null
          last_seen?: string | null
          name: string
          profile_id?: string | null
          updated_at?: string | null
          usn: string
        }
        Update: {
          class?: string | null
          created_at?: string | null
          id?: string
          image_count?: number | null
          last_seen?: string | null
          name?: string
          profile_id?: string | null
          updated_at?: string | null
          usn?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "institute_admin"
        | "department_admin"
        | "student"
        | "faculty"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "super_admin",
        "institute_admin",
        "department_admin",
        "student",
        "faculty",
      ],
    },
  },
} as const
