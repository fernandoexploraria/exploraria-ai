export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      generated_landmarks: {
        Row: {
          api_calls_made: number | null
          confidence: string | null
          coordinate_refinement_attempts: number | null
          coordinate_source: string | null
          coordinates: unknown
          created_at: string
          description: string | null
          editorial_summary: string | null
          error_messages: string[] | null
          fallback_methods_used: string[] | null
          formatted_address: string | null
          id: string
          landmark_id: string
          name: string
          opening_hours: Json | null
          photo_references: string[] | null
          photos: Json | null
          place_id: string | null
          price_level: number | null
          processing_time_ms: number | null
          rating: number | null
          raw_data: Json | null
          search_attempts: number | null
          search_query: string | null
          tour_id: string
          types: string[] | null
          user_ratings_total: number | null
          website_uri: string | null
        }
        Insert: {
          api_calls_made?: number | null
          confidence?: string | null
          coordinate_refinement_attempts?: number | null
          coordinate_source?: string | null
          coordinates: unknown
          created_at?: string
          description?: string | null
          editorial_summary?: string | null
          error_messages?: string[] | null
          fallback_methods_used?: string[] | null
          formatted_address?: string | null
          id?: string
          landmark_id: string
          name: string
          opening_hours?: Json | null
          photo_references?: string[] | null
          photos?: Json | null
          place_id?: string | null
          price_level?: number | null
          processing_time_ms?: number | null
          rating?: number | null
          raw_data?: Json | null
          search_attempts?: number | null
          search_query?: string | null
          tour_id: string
          types?: string[] | null
          user_ratings_total?: number | null
          website_uri?: string | null
        }
        Update: {
          api_calls_made?: number | null
          confidence?: string | null
          coordinate_refinement_attempts?: number | null
          coordinate_source?: string | null
          coordinates?: unknown
          created_at?: string
          description?: string | null
          editorial_summary?: string | null
          error_messages?: string[] | null
          fallback_methods_used?: string[] | null
          formatted_address?: string | null
          id?: string
          landmark_id?: string
          name?: string
          opening_hours?: Json | null
          photo_references?: string[] | null
          photos?: Json | null
          place_id?: string | null
          price_level?: number | null
          processing_time_ms?: number | null
          rating?: number | null
          raw_data?: Json | null
          search_attempts?: number | null
          search_query?: string | null
          tour_id?: string
          types?: string[] | null
          user_ratings_total?: number | null
          website_uri?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generated_landmarks_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "generated_tours"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_tours: {
        Row: {
          coordinate_quality_high: number | null
          coordinate_quality_low: number | null
          coordinate_quality_medium: number | null
          created_at: string
          destination: string
          destination_details: Json | null
          error_count: number | null
          fallbacks_used: string[] | null
          gemini_api_calls: number | null
          generation_end_time: string | null
          generation_start_time: string
          id: string
          places_api_calls: number | null
          success_rate: number | null
          system_prompt: string
          total_landmarks: number
          total_processing_time_ms: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          coordinate_quality_high?: number | null
          coordinate_quality_low?: number | null
          coordinate_quality_medium?: number | null
          created_at?: string
          destination: string
          destination_details?: Json | null
          error_count?: number | null
          fallbacks_used?: string[] | null
          gemini_api_calls?: number | null
          generation_end_time?: string | null
          generation_start_time: string
          id?: string
          places_api_calls?: number | null
          success_rate?: number | null
          system_prompt: string
          total_landmarks?: number
          total_processing_time_ms?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          coordinate_quality_high?: number | null
          coordinate_quality_low?: number | null
          coordinate_quality_medium?: number | null
          created_at?: string
          destination?: string
          destination_details?: Json | null
          error_count?: number | null
          fallbacks_used?: string[] | null
          gemini_api_calls?: number | null
          generation_end_time?: string | null
          generation_start_time?: string
          id?: string
          places_api_calls?: number | null
          success_rate?: number | null
          system_prompt?: string
          total_landmarks?: number
          total_processing_time_ms?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      interactions: {
        Row: {
          agent_id: string | null
          assistant_response: string
          assistant_response_embedding: string | null
          audio_url: string | null
          call_status: string | null
          conversation_duration: number | null
          conversation_id: string | null
          conversation_summary: string | null
          conversation_summary_embedding: string | null
          created_at: string
          destination: string
          discovery_distance: number | null
          efficiency_conciseness_explanation: string | null
          efficiency_conciseness_status: string | null
          end_time: number | null
          engagement_interactivity_explanation: string | null
          engagement_interactivity_status: string | null
          evaluation_criteria_embedding: string | null
          full_transcript: Json | null
          id: string
          info_accuracy_explanation: string | null
          info_accuracy_status: string | null
          interaction_type: string | null
          is_favorite: boolean | null
          landmark_coordinates: unknown | null
          landmark_image_url: string | null
          navigation_effectiveness_explanation: string | null
          navigation_effectiveness_status: string | null
          points_of_interest_embedding: string | null
          points_of_interest_mentioned: string[] | null
          problem_resolution_explanation: string | null
          problem_resolution_status: string | null
          start_time: number | null
          transportation_mode: string | null
          user_id: string | null
          user_input: string
          user_input_embedding: string | null
          user_location: unknown | null
          user_satisfaction_explanation: string | null
          user_satisfaction_status: string | null
        }
        Insert: {
          agent_id?: string | null
          assistant_response: string
          assistant_response_embedding?: string | null
          audio_url?: string | null
          call_status?: string | null
          conversation_duration?: number | null
          conversation_id?: string | null
          conversation_summary?: string | null
          conversation_summary_embedding?: string | null
          created_at?: string
          destination: string
          discovery_distance?: number | null
          efficiency_conciseness_explanation?: string | null
          efficiency_conciseness_status?: string | null
          end_time?: number | null
          engagement_interactivity_explanation?: string | null
          engagement_interactivity_status?: string | null
          evaluation_criteria_embedding?: string | null
          full_transcript?: Json | null
          id?: string
          info_accuracy_explanation?: string | null
          info_accuracy_status?: string | null
          interaction_type?: string | null
          is_favorite?: boolean | null
          landmark_coordinates?: unknown | null
          landmark_image_url?: string | null
          navigation_effectiveness_explanation?: string | null
          navigation_effectiveness_status?: string | null
          points_of_interest_embedding?: string | null
          points_of_interest_mentioned?: string[] | null
          problem_resolution_explanation?: string | null
          problem_resolution_status?: string | null
          start_time?: number | null
          transportation_mode?: string | null
          user_id?: string | null
          user_input: string
          user_input_embedding?: string | null
          user_location?: unknown | null
          user_satisfaction_explanation?: string | null
          user_satisfaction_status?: string | null
        }
        Update: {
          agent_id?: string | null
          assistant_response?: string
          assistant_response_embedding?: string | null
          audio_url?: string | null
          call_status?: string | null
          conversation_duration?: number | null
          conversation_id?: string | null
          conversation_summary?: string | null
          conversation_summary_embedding?: string | null
          created_at?: string
          destination?: string
          discovery_distance?: number | null
          efficiency_conciseness_explanation?: string | null
          efficiency_conciseness_status?: string | null
          end_time?: number | null
          engagement_interactivity_explanation?: string | null
          engagement_interactivity_status?: string | null
          evaluation_criteria_embedding?: string | null
          full_transcript?: Json | null
          id?: string
          info_accuracy_explanation?: string | null
          info_accuracy_status?: string | null
          interaction_type?: string | null
          is_favorite?: boolean | null
          landmark_coordinates?: unknown | null
          landmark_image_url?: string | null
          navigation_effectiveness_explanation?: string | null
          navigation_effectiveness_status?: string | null
          points_of_interest_embedding?: string | null
          points_of_interest_mentioned?: string[] | null
          problem_resolution_explanation?: string | null
          problem_resolution_status?: string | null
          start_time?: number | null
          transportation_mode?: string | null
          user_id?: string | null
          user_input?: string
          user_input_embedding?: string | null
          user_location?: unknown | null
          user_satisfaction_explanation?: string | null
          user_satisfaction_status?: string | null
        }
        Relationships: []
      }
      proximity_alerts: {
        Row: {
          created_at: string
          distance: number
          id: string
          is_enabled: boolean
          landmark_id: string
          last_triggered: string | null
          unit: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          distance?: number
          id?: string
          is_enabled?: boolean
          landmark_id: string
          last_triggered?: string | null
          unit?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          distance?: number
          id?: string
          is_enabled?: boolean
          landmark_id?: string
          last_triggered?: string | null
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      proximity_notifications: {
        Row: {
          created_at: string
          distance: number
          id: string
          landmark_id: string
          landmark_name: string
          notification_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          distance: number
          id?: string
          landmark_id: string
          landmark_name: string
          notification_type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          distance?: number
          id?: string
          landmark_id?: string
          landmark_name?: string
          notification_type?: string
          user_id?: string
        }
        Relationships: []
      }
      proximity_settings: {
        Row: {
          card_distance: number
          created_at: string
          id: string
          is_enabled: boolean
          notification_distance: number
          outer_distance: number
          unit: string
          updated_at: string
          user_id: string
        }
        Insert: {
          card_distance?: number
          created_at?: string
          id?: string
          is_enabled?: boolean
          notification_distance?: number
          outer_distance?: number
          unit?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          card_distance?: number
          created_at?: string
          id?: string
          is_enabled?: boolean
          notification_distance?: number
          outer_distance?: number
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      shared_urls: {
        Row: {
          created_at: string
          id: string
          interaction_id: string | null
          original_url: string
          short_code: string
          url_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          interaction_id?: string | null
          original_url: string
          short_code: string
          url_type: string
        }
        Update: {
          created_at?: string
          id?: string
          interaction_id?: string | null
          original_url?: string
          short_code?: string
          url_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_urls_interaction_id_fkey"
            columns: ["interaction_id"]
            isOneToOne: false
            referencedRelation: "interactions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
          stripe_customer_id: string | null
          subscribed: boolean
          subscription_end: string | null
          subscription_tier: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          stripe_customer_id?: string | null
          subscribed?: boolean
          subscription_end?: string | null
          subscription_tier?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          stripe_customer_id?: string | null
          subscribed?: boolean
          subscription_end?: string | null
          subscription_tier?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      tour_generation_logs: {
        Row: {
          api_endpoint: string | null
          api_response_code: number | null
          api_response_size: number | null
          error_details: Json | null
          execution_time_ms: number | null
          id: string
          log_level: string
          memory_usage_mb: number | null
          message: string
          metadata: Json | null
          phase: string
          timestamp: string
          tour_id: string
        }
        Insert: {
          api_endpoint?: string | null
          api_response_code?: number | null
          api_response_size?: number | null
          error_details?: Json | null
          execution_time_ms?: number | null
          id?: string
          log_level: string
          memory_usage_mb?: number | null
          message: string
          metadata?: Json | null
          phase: string
          timestamp?: string
          tour_id: string
        }
        Update: {
          api_endpoint?: string | null
          api_response_code?: number | null
          api_response_size?: number | null
          error_details?: Json | null
          execution_time_ms?: number | null
          id?: string
          log_level?: string
          memory_usage_mb?: number | null
          message?: string
          metadata?: Json | null
          phase?: string
          timestamp?: string
          tour_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tour_generation_logs_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "generated_tours"
            referencedColumns: ["id"]
          },
        ]
      }
      user_tour_stats: {
        Row: {
          created_at: string
          id: string
          tour_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          tour_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          tour_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      cleanup_all_data: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      increment_tour_count: {
        Args: { p_user_id: string }
        Returns: number
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: unknown
      }
      search_interactions: {
        Args: {
          query_embedding: string
          match_threshold: number
          match_count: number
          user_id: string
        }
        Returns: {
          id: string
          destination: string
          user_input: string
          assistant_response: string
          is_favorite: boolean
          created_at: string
          interaction_type: string
          landmark_coordinates: unknown
          landmark_image_url: string
          full_transcript: Json
          conversation_id: string
          conversation_duration: number
          audio_url: string
          agent_id: string
          similarity: number
        }[]
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
