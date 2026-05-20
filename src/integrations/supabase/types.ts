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
      applications: {
        Row: {
          company: string | null
          cover_letter: string | null
          created_at: string
          drive_file_id: string | null
          drive_folder_id: string | null
          drive_url: string | null
          email_body: string | null
          email_subject: string | null
          id: string
          job_id: string | null
          job_title: string | null
          match_score: number | null
          sent_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          company?: string | null
          cover_letter?: string | null
          created_at?: string
          drive_file_id?: string | null
          drive_folder_id?: string | null
          drive_url?: string | null
          email_body?: string | null
          email_subject?: string | null
          id?: string
          job_id?: string | null
          job_title?: string | null
          match_score?: number | null
          sent_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          company?: string | null
          cover_letter?: string | null
          created_at?: string
          drive_file_id?: string | null
          drive_folder_id?: string | null
          drive_url?: string | null
          email_body?: string | null
          email_subject?: string | null
          id?: string
          job_id?: string | null
          job_title?: string | null
          match_score?: number | null
          sent_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          application_email: string | null
          application_url: string | null
          category: string | null
          company: string | null
          contact_person: string | null
          contact_phone: string | null
          county: string | null
          created_at: string
          deadline: string | null
          description: string | null
          id: string
          job_type: string | null
          location: string | null
          match_gaps: string | null
          match_reason: string | null
          match_score: number | null
          match_strengths: string | null
          notes: string | null
          requirements: string | null
          responsibilities: string | null
          salary_max: number | null
          salary_min: number | null
          salary_text: string | null
          scraped_at: string | null
          source: string | null
          source_url: string | null
          title: string
          tracker_status: string
          user_id: string
        }
        Insert: {
          application_email?: string | null
          application_url?: string | null
          category?: string | null
          company?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          county?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          id?: string
          job_type?: string | null
          location?: string | null
          match_gaps?: string | null
          match_reason?: string | null
          match_score?: number | null
          match_strengths?: string | null
          notes?: string | null
          requirements?: string | null
          responsibilities?: string | null
          salary_max?: number | null
          salary_min?: number | null
          salary_text?: string | null
          scraped_at?: string | null
          source?: string | null
          source_url?: string | null
          title: string
          tracker_status?: string
          user_id: string
        }
        Update: {
          application_email?: string | null
          application_url?: string | null
          category?: string | null
          company?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          county?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          id?: string
          job_type?: string | null
          location?: string | null
          match_gaps?: string | null
          match_reason?: string | null
          match_score?: number | null
          match_strengths?: string | null
          notes?: string | null
          requirements?: string | null
          responsibilities?: string | null
          salary_max?: number | null
          salary_min?: number | null
          salary_text?: string | null
          scraped_at?: string | null
          source?: string | null
          source_url?: string | null
          title?: string
          tracker_status?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          certifications: string | null
          created_at: string
          current_address: string | null
          cv_storage_path: string | null
          cv_url: string | null
          desired_roles: string[] | null
          education: string | null
          email: string | null
          full_name: string | null
          id: string
          languages: string | null
          linkedin_url: string | null
          minimum_salary: number | null
          nationality: string | null
          open_to_remote: boolean | null
          phone: string | null
          preferred_county: string | null
          professional_summary: string | null
          skills: string[] | null
          updated_at: string
          work_history: string | null
        }
        Insert: {
          certifications?: string | null
          created_at?: string
          current_address?: string | null
          cv_storage_path?: string | null
          cv_url?: string | null
          desired_roles?: string[] | null
          education?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          languages?: string | null
          linkedin_url?: string | null
          minimum_salary?: number | null
          nationality?: string | null
          open_to_remote?: boolean | null
          phone?: string | null
          preferred_county?: string | null
          professional_summary?: string | null
          skills?: string[] | null
          updated_at?: string
          work_history?: string | null
        }
        Update: {
          certifications?: string | null
          created_at?: string
          current_address?: string | null
          cv_storage_path?: string | null
          cv_url?: string | null
          desired_roles?: string[] | null
          education?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          languages?: string | null
          linkedin_url?: string | null
          minimum_salary?: number | null
          nationality?: string | null
          open_to_remote?: boolean | null
          phone?: string | null
          preferred_county?: string | null
          professional_summary?: string | null
          skills?: string[] | null
          updated_at?: string
          work_history?: string | null
        }
        Relationships: []
      }
      templates: {
        Row: {
          category: string | null
          content: string
          created_at: string
          id: string
          is_default: boolean | null
          name: string
          tone: string | null
          type: string
          user_id: string
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          name: string
          tone?: string | null
          type?: string
          user_id: string
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          name?: string
          tone?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      workflows: {
        Row: {
          active: boolean | null
          auto_apply: boolean | null
          cover_letter_tone: string | null
          created_at: string
          id: string
          job_types: string[] | null
          max_applications: number | null
          min_match_score: number | null
          minimum_salary: number | null
          name: string
          run_days: string[] | null
          run_time: string | null
          sources: string[] | null
          target_counties: string[] | null
          target_roles: string[] | null
          user_id: string
        }
        Insert: {
          active?: boolean | null
          auto_apply?: boolean | null
          cover_letter_tone?: string | null
          created_at?: string
          id?: string
          job_types?: string[] | null
          max_applications?: number | null
          min_match_score?: number | null
          minimum_salary?: number | null
          name?: string
          run_days?: string[] | null
          run_time?: string | null
          sources?: string[] | null
          target_counties?: string[] | null
          target_roles?: string[] | null
          user_id: string
        }
        Update: {
          active?: boolean | null
          auto_apply?: boolean | null
          cover_letter_tone?: string | null
          created_at?: string
          id?: string
          job_types?: string[] | null
          max_applications?: number | null
          min_match_score?: number | null
          minimum_salary?: number | null
          name?: string
          run_days?: string[] | null
          run_time?: string | null
          sources?: string[] | null
          target_counties?: string[] | null
          target_roles?: string[] | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
