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
      agent_state: {
        Row: {
          agent_name: string
          created_at: string | null
          id: string
          last_run_at: string | null
          learned_preferences: Json | null
          memory: Json | null
          next_run_at: string | null
          organization_id: string
          performance_history: Json | null
          updated_at: string | null
        }
        Insert: {
          agent_name: string
          created_at?: string | null
          id?: string
          last_run_at?: string | null
          learned_preferences?: Json | null
          memory?: Json | null
          next_run_at?: string | null
          organization_id: string
          performance_history?: Json | null
          updated_at?: string | null
        }
        Update: {
          agent_name?: string
          created_at?: string | null
          id?: string
          last_run_at?: string | null
          learned_preferences?: Json | null
          memory?: Json | null
          next_run_at?: string | null
          organization_id?: string
          performance_history?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_state_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notifications: {
        Row: {
          action_label: string | null
          action_url: string | null
          archived_at: string | null
          channels: string[]
          created_at: string | null
          expires_at: string | null
          id: string
          message: string
          metadata: Json | null
          notification_type_id: string | null
          organization_id: string
          priority: string | null
          read_at: string | null
          related_approval_id: string | null
          related_campaign_id: string | null
          related_task_id: string | null
          status: string | null
          title: string
          user_id: string
        }
        Insert: {
          action_label?: string | null
          action_url?: string | null
          archived_at?: string | null
          channels?: string[]
          created_at?: string | null
          expires_at?: string | null
          id?: string
          message: string
          metadata?: Json | null
          notification_type_id?: string | null
          organization_id: string
          priority?: string | null
          read_at?: string | null
          related_approval_id?: string | null
          related_campaign_id?: string | null
          related_task_id?: string | null
          status?: string | null
          title: string
          user_id: string
        }
        Update: {
          action_label?: string | null
          action_url?: string | null
          archived_at?: string | null
          channels?: string[]
          created_at?: string | null
          expires_at?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          notification_type_id?: string | null
          organization_id?: string
          priority?: string | null
          read_at?: string | null
          related_approval_id?: string | null
          related_campaign_id?: string | null
          related_task_id?: string | null
          status?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string | null
          dashboard_preferences: Json | null
          feature_flags: Json | null
          id: string
          keyboard_shortcuts_enabled: boolean | null
          notification_settings: Json | null
          organization_id: string
          ui_preferences: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          dashboard_preferences?: Json | null
          feature_flags?: Json | null
          id?: string
          keyboard_shortcuts_enabled?: boolean | null
          notification_settings?: Json | null
          organization_id: string
          ui_preferences?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          dashboard_preferences?: Json | null
          feature_flags?: Json | null
          id?: string
          keyboard_shortcuts_enabled?: boolean | null
          notification_settings?: Json | null
          organization_id?: string
          ui_preferences?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      brand_voice_profiles: {
        Row: {
          created_at: string | null
          created_by: string | null
          custom_instructions: string | null
          description: string | null
          example_content: Json | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          organization_id: string
          product_id: string
          tone: Json
          updated_at: string | null
          version: number | null
          visual_brand: Json | null
          writing_style: Json
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          custom_instructions?: string | null
          description?: string | null
          example_content?: Json | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          organization_id: string
          product_id: string
          tone?: Json
          updated_at?: string | null
          version?: number | null
          visual_brand?: Json | null
          writing_style?: Json
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          custom_instructions?: string | null
          description?: string | null
          example_content?: Json | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          organization_id?: string
          product_id?: string
          tone?: Json
          updated_at?: string | null
          version?: number | null
          visual_brand?: Json | null
          writing_style?: Json
        }
        Relationships: []
      }
      media_collections: {
        Row: {
          asset_count: number | null
          auto_rules: Json | null
          color: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          icon: string | null
          id: string
          is_pinned: boolean | null
          is_shared: boolean | null
          name: string
          organization_id: string
          parent_collection_id: string | null
          path: string[] | null
          product_id: string | null
          slug: string | null
          updated_at: string | null
        }
        Insert: {
          asset_count?: number | null
          auto_rules?: Json | null
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_pinned?: boolean | null
          is_shared?: boolean | null
          name: string
          organization_id: string
          parent_collection_id?: string | null
          path?: string[] | null
          product_id?: string | null
          slug?: string | null
          updated_at?: string | null
        }
        Update: {
          asset_count?: number | null
          auto_rules?: Json | null
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_pinned?: boolean | null
          is_shared?: boolean | null
          name?: string
          organization_id?: string
          parent_collection_id?: string | null
          path?: string[] | null
          product_id?: string | null
          slug?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      asset_tags: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          organization_id: string
          slug: string
          usage_count: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          organization_id: string
          slug: string
          usage_count?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          slug?: string
          usage_count?: number | null
        }
        Relationships: []
      }
      notification_types: {
        Row: {
          can_unsubscribe: boolean | null
          category: string
          code: string
          created_at: string | null
          default_channels: string[] | null
          description: string | null
          email_body_template: string | null
          email_subject_template: string | null
          id: string
          in_app_template: string | null
          is_active: boolean | null
          name: string
        }
        Insert: {
          can_unsubscribe?: boolean | null
          category: string
          code: string
          created_at?: string | null
          default_channels?: string[] | null
          description?: string | null
          email_body_template?: string | null
          email_subject_template?: string | null
          id?: string
          in_app_template?: string | null
          is_active?: boolean | null
          name: string
        }
        Update: {
          can_unsubscribe?: boolean | null
          category?: string
          code?: string
          created_at?: string | null
          default_channels?: string[] | null
          description?: string | null
          email_body_template?: string | null
          email_subject_template?: string | null
          id?: string
          in_app_template?: string | null
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      global_search: {
        Args: {
          p_limit?: number
          p_organization_id: string
          p_query: string
          p_types?: string[]
        }
        Returns: {
          description: string
          id: string
          metadata: Json
          rank: number
          result_type: string
          status: string
          title: string
          url: string
        }[]
      }
    }
    Enums: {
      approval_status:
        | "pending"
        | "approved"
        | "rejected"
        | "auto_approved"
        | "expired"
      asset_type:
        | "blog_post"
        | "landing_page"
        | "email_template"
        | "social_post"
        | "image"
        | "document"
      campaign_status:
        | "draft"
        | "planned"
        | "active"
        | "paused"
        | "completed"
        | "cancelled"
      connector_type:
        | "email_resend"
        | "email_postmark"
        | "email_sendgrid"
        | "social_twitter"
        | "social_linkedin"
        | "social_facebook"
        | "cms_ghost"
        | "cms_webflow"
        | "cms_wordpress"
        | "ads_google"
        | "ads_facebook"
        | "analytics_posthog"
        | "analytics_ga4"
      experiment_status:
        | "draft"
        | "running"
        | "paused"
        | "completed"
        | "cancelled"
      policy_type:
        | "rate_limit"
        | "banned_phrase"
        | "required_phrase"
        | "claim_lock"
        | "domain_allowlist"
        | "suppression"
        | "time_window"
        | "budget_limit"
        | "content_rule"
      task_status:
        | "queued"
        | "drafting"
        | "drafted"
        | "pending_approval"
        | "approved"
        | "executing"
        | "completed"
        | "failed"
        | "cancelled"
        | "evaluated"
      task_type:
        | "blog_post"
        | "landing_page"
        | "email_single"
        | "email_sequence"
        | "social_post"
        | "seo_optimization"
        | "ad_campaign"
        | "research"
        | "analysis"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (Database["public"]["Tables"] & Database["public"]["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (Database["public"]["Tables"] &
        Database["public"]["Views"])
    ? (Database["public"]["Tables"] &
        Database["public"]["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof Database["public"]["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof Database["public"]["Enums"]
    ? Database["public"]["Enums"][PublicEnumNameOrOptions]
    : never
