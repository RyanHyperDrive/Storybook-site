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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      book_pages: {
        Row: {
          book_id: string
          created_at: string
          id: string
          image_storage_path: string | null
          needs_review: boolean
          page_number: number
          quality_score: number | null
          regenerations: number
          review_notes: string | null
          status: string
          text_content: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          book_id: string
          created_at?: string
          id?: string
          image_storage_path?: string | null
          needs_review?: boolean
          page_number: number
          quality_score?: number | null
          regenerations?: number
          review_notes?: string | null
          status?: string
          text_content?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          book_id?: string
          created_at?: string
          id?: string
          image_storage_path?: string | null
          needs_review?: boolean
          page_number?: number
          quality_score?: number | null
          regenerations?: number
          review_notes?: string | null
          status?: string
          text_content?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_pages_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      books: {
        Row: {
          art_style: string | null
          child_age: number | null
          child_loves: string | null
          child_name: string | null
          child_pronouns: string | null
          cover_url: string | null
          created_at: string
          dedication: string | null
          details_avoid: string | null
          details_include: string | null
          ebook_url: string | null
          guardian_consent_at: string | null
          id: string
          is_twins: boolean
          page_count: number | null
          reading_level: string | null
          status: string
          story_prompt: string | null
          story_theme: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          art_style?: string | null
          child_age?: number | null
          child_loves?: string | null
          child_name?: string | null
          child_pronouns?: string | null
          cover_url?: string | null
          created_at?: string
          dedication?: string | null
          details_avoid?: string | null
          details_include?: string | null
          ebook_url?: string | null
          guardian_consent_at?: string | null
          id?: string
          is_twins?: boolean
          page_count?: number | null
          reading_level?: string | null
          status?: string
          story_prompt?: string | null
          story_theme?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          art_style?: string | null
          child_age?: number | null
          child_loves?: string | null
          child_name?: string | null
          child_pronouns?: string | null
          cover_url?: string | null
          created_at?: string
          dedication?: string | null
          details_avoid?: string | null
          details_include?: string | null
          ebook_url?: string | null
          guardian_consent_at?: string | null
          id?: string
          is_twins?: boolean
          page_count?: number | null
          reading_level?: string | null
          status?: string
          story_prompt?: string | null
          story_theme?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      character_sheets: {
        Row: {
          approved: boolean
          book_id: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          regenerations: number
          user_id: string
        }
        Insert: {
          approved?: boolean
          book_id: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          regenerations?: number
          user_id: string
        }
        Update: {
          approved?: boolean
          book_id?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          regenerations?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_sheets_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      child_profiles: {
        Row: {
          accessibility_details: string | null
          age: number | null
          book_id: string | null
          created_at: string
          default_art_style: string | null
          favorite_activities: string | null
          favorite_color: string | null
          id: string
          loves: string | null
          name: string
          notes: string | null
          personality_traits: string | null
          pronouns: string | null
          slot: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          accessibility_details?: string | null
          age?: number | null
          book_id?: string | null
          created_at?: string
          default_art_style?: string | null
          favorite_activities?: string | null
          favorite_color?: string | null
          id?: string
          loves?: string | null
          name: string
          notes?: string | null
          personality_traits?: string | null
          pronouns?: string | null
          slot?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          accessibility_details?: string | null
          age?: number | null
          book_id?: string | null
          created_at?: string
          default_art_style?: string | null
          favorite_activities?: string | null
          favorite_color?: string | null
          id?: string
          loves?: string | null
          name?: string
          notes?: string | null
          personality_traits?: string | null
          pronouns?: string | null
          slot?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "child_profiles_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      child_subjects: {
        Row: {
          approved: boolean
          character_image_url: string | null
          child_profile_id: string | null
          created_at: string
          description: string | null
          error_message: string | null
          id: string
          locked: boolean
          reference_storage_path: string | null
          regenerations: number
          status: string
          twins_distinguishable_confirmed: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          approved?: boolean
          character_image_url?: string | null
          child_profile_id?: string | null
          created_at?: string
          description?: string | null
          error_message?: string | null
          id?: string
          locked?: boolean
          reference_storage_path?: string | null
          regenerations?: number
          status?: string
          twins_distinguishable_confirmed?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          approved?: boolean
          character_image_url?: string | null
          child_profile_id?: string | null
          created_at?: string
          description?: string | null
          error_message?: string | null
          id?: string
          locked?: boolean
          reference_storage_path?: string | null
          regenerations?: number
          status?: string
          twins_distinguishable_confirmed?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "child_subjects_child_profile_id_fkey"
            columns: ["child_profile_id"]
            isOneToOne: false
            referencedRelation: "child_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_jobs: {
        Row: {
          book_id: string | null
          created_at: string
          error_message: string | null
          id: string
          kind: string
          payload: Json | null
          progress: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          book_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          kind: string
          payload?: Json | null
          progress?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          book_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          kind?: string
          payload?: Json | null
          progress?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_jobs_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          book_id: string
          created_at: string
          current_step: string
          id: string
          kind: string
          message: string | null
          progress: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          book_id: string
          created_at?: string
          current_step?: string
          id?: string
          kind: string
          message?: string | null
          progress?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          book_id?: string
          created_at?: string
          current_step?: string
          id?: string
          kind?: string
          message?: string | null
          progress?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number | null
          book_id: string | null
          created_at: string
          currency: string | null
          id: string
          provider: string
          provider_payment_intent: string | null
          provider_session_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents?: number | null
          book_id?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          provider?: string
          provider_payment_intent?: string | null
          provider_session_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number | null
          book_id?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          provider?: string
          provider_payment_intent?: string | null
          provider_session_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      photos: {
        Row: {
          book_id: string
          created_at: string
          id: string
          storage_path: string
          user_id: string
        }
        Insert: {
          book_id: string
          created_at?: string
          id?: string
          storage_path: string
          user_id: string
        }
        Update: {
          book_id?: string
          created_at?: string
          id?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "photos_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      print_interest: {
        Row: {
          child_age: number | null
          created_at: string
          email: string
          id: string
          notes: string | null
          user_id: string | null
        }
        Insert: {
          child_age?: number | null
          created_at?: string
          email: string
          id?: string
          notes?: string | null
          user_id?: string | null
        }
        Update: {
          child_age?: number | null
          created_at?: string
          email?: string
          id?: string
          notes?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      sample_art_assets: {
        Row: {
          asset_type: string
          created_at: string
          error_message: string | null
          id: string
          kie_task_id: string | null
          prompt: string
          public_url: string | null
          sample_key: string
          source_url: string | null
          status: string
          storage_path: string | null
          style_key: string
          updated_at: string
        }
        Insert: {
          asset_type: string
          created_at?: string
          error_message?: string | null
          id?: string
          kie_task_id?: string | null
          prompt: string
          public_url?: string | null
          sample_key: string
          source_url?: string | null
          status?: string
          storage_path?: string | null
          style_key: string
          updated_at?: string
        }
        Update: {
          asset_type?: string
          created_at?: string
          error_message?: string | null
          id?: string
          kie_task_id?: string | null
          prompt?: string
          public_url?: string | null
          sample_key?: string
          source_url?: string | null
          status?: string
          storage_path?: string | null
          style_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      uploaded_photos: {
        Row: {
          book_id: string | null
          child_profile_id: string | null
          created_at: string
          exif_stripped: boolean
          id: string
          mime_type: string | null
          size_bytes: number | null
          slot: string | null
          status: string
          storage_bucket: string
          storage_path: string
          user_id: string
        }
        Insert: {
          book_id?: string | null
          child_profile_id?: string | null
          created_at?: string
          exif_stripped?: boolean
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          slot?: string | null
          status?: string
          storage_bucket?: string
          storage_path: string
          user_id: string
        }
        Update: {
          book_id?: string | null
          child_profile_id?: string | null
          created_at?: string
          exif_stripped?: boolean
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          slot?: string | null
          status?: string
          storage_bucket?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "uploaded_photos_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uploaded_photos_child_profile_id_fkey"
            columns: ["child_profile_id"]
            isOneToOne: false
            referencedRelation: "child_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
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
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
