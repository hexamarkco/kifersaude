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
      access_profiles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_admin: boolean
          is_system: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_admin?: boolean
          is_system?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_admin?: boolean
          is_system?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_autonomous_reply_jobs: {
        Row: {
          attempts: number
          chat_id: string
          created_at: string
          id: string
          last_error: string | null
          lead_id: string | null
          scheduled_at: string
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          chat_id: string
          created_at?: string
          id?: string
          last_error?: string | null
          lead_id?: string | null
          scheduled_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          chat_id?: string
          created_at?: string
          id?: string
          last_error?: string | null
          lead_id?: string | null
          scheduled_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_autonomous_reply_jobs_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "comm_whatsapp_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_autonomous_reply_jobs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_call_attempts: {
        Row: {
          applied_reasoning_effort: string | null
          attempt_number: number
          cached_input_tokens: number | null
          call_id: string
          created_at: string
          duration_ms: number | null
          error_code: string | null
          error_message: string | null
          estimated_cost_usd: number | null
          id: string
          input_tokens: number | null
          model: string
          output_tokens: number | null
          provider: string
          reasoning_tokens: number | null
          requested_reasoning_effort: string | null
          resolution_source: string
          success: boolean
          total_tokens: number | null
        }
        Insert: {
          applied_reasoning_effort?: string | null
          attempt_number: number
          cached_input_tokens?: number | null
          call_id: string
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          error_message?: string | null
          estimated_cost_usd?: number | null
          id?: string
          input_tokens?: number | null
          model: string
          output_tokens?: number | null
          provider: string
          reasoning_tokens?: number | null
          requested_reasoning_effort?: string | null
          resolution_source: string
          success?: boolean
          total_tokens?: number | null
        }
        Update: {
          applied_reasoning_effort?: string | null
          attempt_number?: number
          cached_input_tokens?: number | null
          call_id?: string
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          error_message?: string | null
          estimated_cost_usd?: number | null
          id?: string
          input_tokens?: number | null
          model?: string
          output_tokens?: number | null
          provider?: string
          reasoning_tokens?: number | null
          requested_reasoning_effort?: string | null
          resolution_source?: string
          success?: boolean
          total_tokens?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_call_attempts_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "ai_call_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_call_logs: {
        Row: {
          ai_task: string
          attempts_count: number
          chat_id: string | null
          created_at: string
          edge_function: string | null
          fallback_used: boolean
          feature_key: string
          final_model: string | null
          final_provider: string | null
          id: string
          lead_id: string | null
          message_id: string | null
          retry_count: number
          stop_reason: string | null
          success: boolean
          total_cached_tokens: number | null
          total_duration_ms: number | null
          total_estimated_cost_usd: number | null
          total_input_tokens: number | null
          total_output_tokens: number | null
          total_reasoning_tokens: number | null
          total_tokens: number | null
        }
        Insert: {
          ai_task: string
          attempts_count?: number
          chat_id?: string | null
          created_at?: string
          edge_function?: string | null
          fallback_used?: boolean
          feature_key: string
          final_model?: string | null
          final_provider?: string | null
          id?: string
          lead_id?: string | null
          message_id?: string | null
          retry_count?: number
          stop_reason?: string | null
          success?: boolean
          total_cached_tokens?: number | null
          total_duration_ms?: number | null
          total_estimated_cost_usd?: number | null
          total_input_tokens?: number | null
          total_output_tokens?: number | null
          total_reasoning_tokens?: number | null
          total_tokens?: number | null
        }
        Update: {
          ai_task?: string
          attempts_count?: number
          chat_id?: string | null
          created_at?: string
          edge_function?: string | null
          fallback_used?: boolean
          feature_key?: string
          final_model?: string | null
          final_provider?: string | null
          id?: string
          lead_id?: string | null
          message_id?: string | null
          retry_count?: number
          stop_reason?: string | null
          success?: boolean
          total_cached_tokens?: number | null
          total_duration_ms?: number | null
          total_estimated_cost_usd?: number | null
          total_input_tokens?: number | null
          total_output_tokens?: number | null
          total_reasoning_tokens?: number | null
          total_tokens?: number | null
        }
        Relationships: []
      }
      ai_config_versions: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          scope: string
          scope_key: string
          snapshot: Json
          version: number
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          scope: string
          scope_key: string
          snapshot: Json
          version: number
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          scope?: string
          scope_key?: string
          snapshot?: Json
          version?: number
        }
        Relationships: []
      }
      ai_feature_configs: {
        Row: {
          activated_at: string | null
          context_config_json: Json | null
          created_at: string | null
          created_by: string | null
          deactivated_at: string | null
          fallback_model: string | null
          feature_id: string
          feature_prompt: string | null
          id: string
          is_active: boolean | null
          max_output_tokens: number | null
          model: string | null
          model_override_enabled: boolean | null
          output_instructions: string | null
          provider: string | null
          reasoning_effort: string | null
          retry_count: number | null
          temperature: number | null
          timeout_ms: number | null
          use_global_instructions: boolean | null
          use_global_style: boolean | null
          version: number
        }
        Insert: {
          activated_at?: string | null
          context_config_json?: Json | null
          created_at?: string | null
          created_by?: string | null
          deactivated_at?: string | null
          fallback_model?: string | null
          feature_id: string
          feature_prompt?: string | null
          id?: string
          is_active?: boolean | null
          max_output_tokens?: number | null
          model?: string | null
          model_override_enabled?: boolean | null
          output_instructions?: string | null
          provider?: string | null
          reasoning_effort?: string | null
          retry_count?: number | null
          temperature?: number | null
          timeout_ms?: number | null
          use_global_instructions?: boolean | null
          use_global_style?: boolean | null
          version?: number
        }
        Update: {
          activated_at?: string | null
          context_config_json?: Json | null
          created_at?: string | null
          created_by?: string | null
          deactivated_at?: string | null
          fallback_model?: string | null
          feature_id?: string
          feature_prompt?: string | null
          id?: string
          is_active?: boolean | null
          max_output_tokens?: number | null
          model?: string | null
          model_override_enabled?: boolean | null
          output_instructions?: string | null
          provider?: string | null
          reasoning_effort?: string | null
          retry_count?: number | null
          temperature?: number | null
          timeout_ms?: number | null
          use_global_instructions?: boolean | null
          use_global_style?: boolean | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_feature_configs_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "ai_features"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_features: {
        Row: {
          available_variables: Json | null
          category: string
          created_at: string | null
          default_feature_prompt: string | null
          default_max_output_tokens: number | null
          default_output_instructions: string | null
          default_temperature: number | null
          description: string | null
          enabled: boolean | null
          id: string
          key: string
          name: string
          task_type: string
          updated_at: string | null
        }
        Insert: {
          available_variables?: Json | null
          category?: string
          created_at?: string | null
          default_feature_prompt?: string | null
          default_max_output_tokens?: number | null
          default_output_instructions?: string | null
          default_temperature?: number | null
          description?: string | null
          enabled?: boolean | null
          id?: string
          key: string
          name: string
          task_type: string
          updated_at?: string | null
        }
        Update: {
          available_variables?: Json | null
          category?: string
          created_at?: string | null
          default_feature_prompt?: string | null
          default_max_output_tokens?: number | null
          default_output_instructions?: string | null
          default_temperature?: number | null
          description?: string | null
          enabled?: boolean | null
          id?: string
          key?: string
          name?: string
          task_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_global_configs: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string | null
          updated_by: string | null
          value: string | null
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value?: string | null
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: string | null
        }
        Relationships: []
      }
      ai_model_pricing: {
        Row: {
          active: boolean | null
          cached_input_per_million: number | null
          created_at: string | null
          effective_from: string
          effective_to: string | null
          id: string
          input_per_million: number
          is_transcription: boolean | null
          model: string
          output_per_million: number
          provider: string
          transcription_per_minute: number | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          cached_input_per_million?: number | null
          created_at?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          input_per_million?: number
          is_transcription?: boolean | null
          model: string
          output_per_million?: number
          provider: string
          transcription_per_minute?: number | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          cached_input_per_million?: number | null
          created_at?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          input_per_million?: number
          is_transcription?: boolean | null
          model?: string
          output_per_million?: number
          provider?: string
          transcription_per_minute?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_models: {
        Row: {
          active: boolean
          capabilities: string[]
          created_at: string | null
          deprecated_at: string | null
          display_name: string
          id: string
          model: string
          provider: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean
          capabilities?: string[]
          created_at?: string | null
          deprecated_at?: string | null
          display_name: string
          id?: string
          model: string
          provider: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean
          capabilities?: string[]
          created_at?: string | null
          deprecated_at?: string | null
          display_name?: string
          id?: string
          model?: string
          provider?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_sandbox_conversations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_automated: boolean
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_automated?: boolean
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_automated?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_sandbox_conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_sandbox_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          handoff_code: string | null
          handoff_reason: string | null
          id: string
          model: string | null
          provider: string | null
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          handoff_code?: string | null
          handoff_reason?: string | null
          id?: string
          model?: string | null
          provider?: string | null
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          handoff_code?: string | null
          handoff_reason?: string | null
          id?: string
          model?: string | null
          provider?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_sandbox_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_sandbox_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_sandbox_test_runs: {
        Row: {
          conversation_id: string
          created_at: string
          handoff_code: string | null
          handoff_triggered: boolean
          id: string
          model: string | null
          passed: boolean | null
          provider: string | null
          scenario_key: string
          scenario_label: string
          turns: number
          verdict: Json
        }
        Insert: {
          conversation_id: string
          created_at?: string
          handoff_code?: string | null
          handoff_triggered?: boolean
          id?: string
          model?: string | null
          passed?: boolean | null
          provider?: string | null
          scenario_key: string
          scenario_label: string
          turns?: number
          verdict?: Json
        }
        Update: {
          conversation_id?: string
          created_at?: string
          handoff_code?: string | null
          handoff_triggered?: boolean
          id?: string
          model?: string | null
          passed?: boolean | null
          provider?: string | null
          scenario_key?: string
          scenario_label?: string
          turns?: number
          verdict?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ai_sandbox_test_runs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_sandbox_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_results: {
        Row: {
          chat_resolution_method: string | null
          classification: string
          confidence: number | null
          created_at: string | null
          do_not_reactivate: boolean | null
          evidence_snippet: string | null
          furthest_stage: string | null
          has_conversation: boolean | null
          id: string
          last_inbound_at: string | null
          last_message_direction: string | null
          last_outbound_at: string | null
          lead_id: string
          lead_nome: string | null
          lead_telefone: string | null
          message_count: number | null
          reason_code: string
          reason_text: string | null
          run_id: string
        }
        Insert: {
          chat_resolution_method?: string | null
          classification: string
          confidence?: number | null
          created_at?: string | null
          do_not_reactivate?: boolean | null
          evidence_snippet?: string | null
          furthest_stage?: string | null
          has_conversation?: boolean | null
          id?: string
          last_inbound_at?: string | null
          last_message_direction?: string | null
          last_outbound_at?: string | null
          lead_id: string
          lead_nome?: string | null
          lead_telefone?: string | null
          message_count?: number | null
          reason_code: string
          reason_text?: string | null
          run_id: string
        }
        Update: {
          chat_resolution_method?: string | null
          classification?: string
          confidence?: number | null
          created_at?: string | null
          do_not_reactivate?: boolean | null
          evidence_snippet?: string | null
          furthest_stage?: string | null
          has_conversation?: boolean | null
          id?: string
          last_inbound_at?: string | null
          last_message_direction?: string | null
          last_outbound_at?: string | null
          lead_id?: string
          lead_nome?: string | null
          lead_telefone?: string | null
          message_count?: number | null
          reason_code?: string
          reason_text?: string | null
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_results_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_results_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "audit_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_run_targets: {
        Row: {
          lead_id: string
          ordinal: number
          processed_at: string | null
          run_id: string
        }
        Insert: {
          lead_id: string
          ordinal: number
          processed_at?: string | null
          run_id: string
        }
        Update: {
          lead_id?: string
          ordinal?: number
          processed_at?: string | null
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_run_targets_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_run_targets_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "audit_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_runs: {
        Row: {
          completed_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          started_at: string | null
          summary: Json | null
          total_leads: number | null
        }
        Insert: {
          completed_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          started_at?: string | null
          summary?: Json | null
          total_leads?: number | null
        }
        Update: {
          completed_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          started_at?: string | null
          summary?: Json | null
          total_leads?: number | null
        }
        Relationships: []
      }
      auto_contact_dispatch_throttle: {
        Row: {
          next_send_at: string
          singleton: boolean
          updated_at: string
        }
        Insert: {
          next_send_at?: string
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          next_send_at?: string
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      auto_contact_flow_executions: {
        Row: {
          created_at: string | null
          executed_at: string | null
          flow_id: string
          id: string
          lead_id: string
        }
        Insert: {
          created_at?: string | null
          executed_at?: string | null
          flow_id: string
          id?: string
          lead_id: string
        }
        Update: {
          created_at?: string | null
          executed_at?: string | null
          flow_id?: string
          id?: string
          lead_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_contact_flow_executions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_contact_flow_jobs: {
        Row: {
          action_payload: Json | null
          action_type: string
          attempts: number
          created_at: string | null
          custom_message: Json | null
          enrollment_id: string | null
          flow_id: string
          id: string
          last_error: string | null
          lead_id: string
          message_source: string | null
          scheduled_at: string
          status: string
          status_to_set: string | null
          step_id: string
          step_order: number | null
          template_id: string | null
          trigger_message_at: string | null
          trigger_message_id: string | null
          updated_at: string | null
        }
        Insert: {
          action_payload?: Json | null
          action_type: string
          attempts?: number
          created_at?: string | null
          custom_message?: Json | null
          enrollment_id?: string | null
          flow_id: string
          id?: string
          last_error?: string | null
          lead_id: string
          message_source?: string | null
          scheduled_at: string
          status?: string
          status_to_set?: string | null
          step_id: string
          step_order?: number | null
          template_id?: string | null
          trigger_message_at?: string | null
          trigger_message_id?: string | null
          updated_at?: string | null
        }
        Update: {
          action_payload?: Json | null
          action_type?: string
          attempts?: number
          created_at?: string | null
          custom_message?: Json | null
          enrollment_id?: string | null
          flow_id?: string
          id?: string
          last_error?: string | null
          lead_id?: string
          message_source?: string | null
          scheduled_at?: string
          status?: string
          status_to_set?: string | null
          step_id?: string
          step_order?: number | null
          template_id?: string | null
          trigger_message_at?: string | null
          trigger_message_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auto_contact_flow_jobs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_run_log: {
        Row: {
          details: Json
          error: string | null
          function_name: string
          id: string
          run_at: string
          status: string
        }
        Insert: {
          details?: Json
          error?: string | null
          function_name: string
          id?: string
          run_at?: string
          status?: string
        }
        Update: {
          details?: Json
          error?: string | null
          function_name?: string
          id?: string
          run_at?: string
          status?: string
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          author_id: string | null
          category: string
          content: string
          cover_image_url: string | null
          created_at: string | null
          excerpt: string
          id: string
          meta_description: string | null
          meta_title: string | null
          published: boolean
          published_at: string | null
          read_time: string
          slug: string
          title: string
          updated_at: string | null
          views_count: number | null
        }
        Insert: {
          author_id?: string | null
          category?: string
          content: string
          cover_image_url?: string | null
          created_at?: string | null
          excerpt: string
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          published?: boolean
          published_at?: string | null
          read_time?: string
          slug: string
          title: string
          updated_at?: string | null
          views_count?: number | null
        }
        Update: {
          author_id?: string | null
          category?: string
          content?: string
          cover_image_url?: string | null
          created_at?: string | null
          excerpt?: string
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          published?: boolean
          published_at?: string | null
          read_time?: string
          slug?: string
          title?: string
          updated_at?: string | null
          views_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chatgpt_mcp_audit_log: {
        Row: {
          actor: string
          created_at: string
          id: string
          request_summary: Json
          resource_name: string | null
          tool_name: string
        }
        Insert: {
          actor: string
          created_at?: string
          id?: string
          request_summary?: Json
          resource_name?: string | null
          tool_name: string
        }
        Update: {
          actor?: string
          created_at?: string
          id?: string
          request_summary?: Json
          resource_name?: string | null
          tool_name?: string
        }
        Relationships: []
      }
      comm_follow_up_audit_log: {
        Row: {
          approved_schedule_date: string | null
          batch_id: string | null
          blocker: string | null
          chat_id: string
          commercial_function: string | null
          created_at: string
          created_reminder_id: string | null
          current_action: string | null
          current_action_reason: string | null
          decision_maker: string | null
          generated_by: string | null
          generated_text: string | null
          goal: string | null
          id: string
          last_commercial_commitment: string | null
          lead_id: string
          model: string | null
          next_action_due_at: string | null
          next_action_owner: string | null
          next_action_title: string | null
          opportunity_recommendation: string | null
          pending_microdecision: string | null
          provider: string | null
          rationale: string | null
          reminder_origin: string | null
          schedule_action: string | null
          schedule_approved: boolean | null
          schedule_approved_at: string | null
          schedule_approved_by: string | null
          schedule_confidence: string | null
          schedule_reason: string | null
          schedule_suggested_date: string | null
          sent_at: string
          sent_at_actual: string | null
          sent_text: string | null
          source_reminder_id: string | null
          stage: string | null
          text_content: string
          trigger_source: string | null
          v3_analysis: Json | null
          v3_analysis_model: string | null
          v3_copy_model: string | null
          v3_feedback: string | null
          v3_feedback_at: string | null
          v3_regeneration_count: number | null
          v3_strategy: Json | null
          v3_validation: Json | null
        }
        Insert: {
          approved_schedule_date?: string | null
          batch_id?: string | null
          blocker?: string | null
          chat_id: string
          commercial_function?: string | null
          created_at?: string
          created_reminder_id?: string | null
          current_action?: string | null
          current_action_reason?: string | null
          decision_maker?: string | null
          generated_by?: string | null
          generated_text?: string | null
          goal?: string | null
          id?: string
          last_commercial_commitment?: string | null
          lead_id: string
          model?: string | null
          next_action_due_at?: string | null
          next_action_owner?: string | null
          next_action_title?: string | null
          opportunity_recommendation?: string | null
          pending_microdecision?: string | null
          provider?: string | null
          rationale?: string | null
          reminder_origin?: string | null
          schedule_action?: string | null
          schedule_approved?: boolean | null
          schedule_approved_at?: string | null
          schedule_approved_by?: string | null
          schedule_confidence?: string | null
          schedule_reason?: string | null
          schedule_suggested_date?: string | null
          sent_at?: string
          sent_at_actual?: string | null
          sent_text?: string | null
          source_reminder_id?: string | null
          stage?: string | null
          text_content: string
          trigger_source?: string | null
          v3_analysis?: Json | null
          v3_analysis_model?: string | null
          v3_copy_model?: string | null
          v3_feedback?: string | null
          v3_feedback_at?: string | null
          v3_regeneration_count?: number | null
          v3_strategy?: Json | null
          v3_validation?: Json | null
        }
        Update: {
          approved_schedule_date?: string | null
          batch_id?: string | null
          blocker?: string | null
          chat_id?: string
          commercial_function?: string | null
          created_at?: string
          created_reminder_id?: string | null
          current_action?: string | null
          current_action_reason?: string | null
          decision_maker?: string | null
          generated_by?: string | null
          generated_text?: string | null
          goal?: string | null
          id?: string
          last_commercial_commitment?: string | null
          lead_id?: string
          model?: string | null
          next_action_due_at?: string | null
          next_action_owner?: string | null
          next_action_title?: string | null
          opportunity_recommendation?: string | null
          pending_microdecision?: string | null
          provider?: string | null
          rationale?: string | null
          reminder_origin?: string | null
          schedule_action?: string | null
          schedule_approved?: boolean | null
          schedule_approved_at?: string | null
          schedule_approved_by?: string | null
          schedule_confidence?: string | null
          schedule_reason?: string | null
          schedule_suggested_date?: string | null
          sent_at?: string
          sent_at_actual?: string | null
          sent_text?: string | null
          source_reminder_id?: string | null
          stage?: string | null
          text_content?: string
          trigger_source?: string | null
          v3_analysis?: Json | null
          v3_analysis_model?: string | null
          v3_copy_model?: string | null
          v3_feedback?: string | null
          v3_feedback_at?: string | null
          v3_regeneration_count?: number | null
          v3_strategy?: Json | null
          v3_validation?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "comm_follow_up_audit_log_created_reminder_id_fkey"
            columns: ["created_reminder_id"]
            isOneToOne: false
            referencedRelation: "reminders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_follow_up_audit_log_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_follow_up_audit_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_follow_up_audit_log_schedule_approved_by_fkey"
            columns: ["schedule_approved_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_follow_up_audit_log_source_reminder_id_fkey"
            columns: ["source_reminder_id"]
            isOneToOne: false
            referencedRelation: "reminders"
            referencedColumns: ["id"]
          },
        ]
      }
      comm_whatsapp_action_rate_limits: {
        Row: {
          last_seen_at: string
          request_count: number
          scope: string
          user_id: string
          window_started_at: string
        }
        Insert: {
          last_seen_at?: string
          request_count?: number
          scope: string
          user_id: string
          window_started_at?: string
        }
        Update: {
          last_seen_at?: string
          request_count?: number
          scope?: string
          user_id?: string
          window_started_at?: string
        }
        Relationships: []
      }
      comm_whatsapp_ai_intent_suggestions: {
        Row: {
          campaign_id: string | null
          chat_id: string | null
          commercial_intent: string | null
          confidence: number
          contact_permission: string | null
          created_at: string
          evidence: string | null
          id: string
          intent: string
          lead_id: string | null
          message_id: string | null
          phone_digits: string | null
          reason: string | null
          recommended_action: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          campaign_id?: string | null
          chat_id?: string | null
          commercial_intent?: string | null
          confidence?: number
          contact_permission?: string | null
          created_at?: string
          evidence?: string | null
          id?: string
          intent: string
          lead_id?: string | null
          message_id?: string | null
          phone_digits?: string | null
          reason?: string | null
          recommended_action?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string | null
          chat_id?: string | null
          commercial_intent?: string | null
          confidence?: number
          contact_permission?: string | null
          created_at?: string
          evidence?: string | null
          id?: string
          intent?: string
          lead_id?: string | null
          message_id?: string | null
          phone_digits?: string | null
          reason?: string | null
          recommended_action?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comm_whatsapp_ai_intent_suggestions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "comm_whatsapp_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_whatsapp_ai_intent_suggestions_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "comm_whatsapp_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_whatsapp_ai_intent_suggestions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_whatsapp_ai_intent_suggestions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "comm_whatsapp_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      comm_whatsapp_attendance_critiques: {
        Row: {
          chat_id: string
          created_at: string
          critique: Json
          generated_at: string
          generated_by: string | null
          id: string
          message_count: number
          model: string
          provider: string
          session_ended_at: string
          session_started_at: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          critique: Json
          generated_at?: string
          generated_by?: string | null
          id?: string
          message_count?: number
          model: string
          provider: string
          session_ended_at: string
          session_started_at: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          critique?: Json
          generated_at?: string
          generated_by?: string | null
          id?: string
          message_count?: number
          model?: string
          provider?: string
          session_ended_at?: string
          session_started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comm_whatsapp_attendance_critiques_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "comm_whatsapp_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_whatsapp_attendance_critiques_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comm_whatsapp_campaign_events: {
        Row: {
          campaign_id: string
          created_at: string
          created_by: string | null
          event_type: string
          id: string
          payload: Json
          target_id: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          created_by?: string | null
          event_type: string
          id?: string
          payload?: Json
          target_id?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          created_by?: string | null
          event_type?: string
          id?: string
          payload?: Json
          target_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comm_whatsapp_campaign_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "comm_whatsapp_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_whatsapp_campaign_events_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "comm_whatsapp_campaign_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      comm_whatsapp_campaign_step_dispatches: {
        Row: {
          attempts: number
          campaign_id: string
          created_at: string
          delivery_status: string | null
          dispatch_key: string
          error_message: string | null
          external_message_id: string | null
          id: string
          next_retry_at: string | null
          persisted_at: string | null
          provider_accepted_at: string | null
          resolution: string | null
          resolved_at: string | null
          stage_index: number
          status: string
          step_index: number
          target_id: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          campaign_id: string
          created_at?: string
          delivery_status?: string | null
          dispatch_key: string
          error_message?: string | null
          external_message_id?: string | null
          id?: string
          next_retry_at?: string | null
          persisted_at?: string | null
          provider_accepted_at?: string | null
          resolution?: string | null
          resolved_at?: string | null
          stage_index: number
          status?: string
          step_index: number
          target_id: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          campaign_id?: string
          created_at?: string
          delivery_status?: string | null
          dispatch_key?: string
          error_message?: string | null
          external_message_id?: string | null
          id?: string
          next_retry_at?: string | null
          persisted_at?: string | null
          provider_accepted_at?: string | null
          resolution?: string | null
          resolved_at?: string | null
          stage_index?: number
          status?: string
          step_index?: number
          target_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comm_whatsapp_campaign_step_dispatches_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "comm_whatsapp_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_whatsapp_campaign_step_dispatches_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "comm_whatsapp_campaign_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      comm_whatsapp_campaign_steps: {
        Row: {
          campaign_id: string
          created_at: string
          delay_amount: number
          delay_unit: string
          id: string
          media_filename: string | null
          media_type: string | null
          media_url: string | null
          message_text: string
          stage_index: number
          status_to_set: string | null
          step_index: number
          step_kind: string
          updated_at: string
          variant_label: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          delay_amount?: number
          delay_unit?: string
          id?: string
          media_filename?: string | null
          media_type?: string | null
          media_url?: string | null
          message_text: string
          stage_index?: number
          status_to_set?: string | null
          step_index: number
          step_kind?: string
          updated_at?: string
          variant_label?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          delay_amount?: number
          delay_unit?: string
          id?: string
          media_filename?: string | null
          media_type?: string | null
          media_url?: string | null
          message_text?: string
          stage_index?: number
          status_to_set?: string | null
          step_index?: number
          step_kind?: string
          updated_at?: string
          variant_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "comm_whatsapp_campaign_steps_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "comm_whatsapp_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      comm_whatsapp_campaign_targets: {
        Row: {
          ab_variant: string | null
          attempts: number
          campaign_id: string
          chat_id: string | null
          created_at: string
          current_step_index: number
          display_name: string | null
          error_message: string | null
          external_message_id: string | null
          id: string
          last_attempt_at: string | null
          lead_id: string | null
          lock_token: string | null
          locked_at: string | null
          next_retry_at: string | null
          next_send_at: string | null
          phone_digits: string
          phone_number: string
          responded_at: string | null
          retry_count: number
          sent_at: string | null
          source_kind: string
          source_payload: Json
          status: string
          stopped_at: string | null
          stopped_reason: string | null
          updated_at: string
          whatsapp_check_status: string
          whatsapp_checked_at: string | null
        }
        Insert: {
          ab_variant?: string | null
          attempts?: number
          campaign_id: string
          chat_id?: string | null
          created_at?: string
          current_step_index?: number
          display_name?: string | null
          error_message?: string | null
          external_message_id?: string | null
          id?: string
          last_attempt_at?: string | null
          lead_id?: string | null
          lock_token?: string | null
          locked_at?: string | null
          next_retry_at?: string | null
          next_send_at?: string | null
          phone_digits: string
          phone_number: string
          responded_at?: string | null
          retry_count?: number
          sent_at?: string | null
          source_kind?: string
          source_payload?: Json
          status?: string
          stopped_at?: string | null
          stopped_reason?: string | null
          updated_at?: string
          whatsapp_check_status?: string
          whatsapp_checked_at?: string | null
        }
        Update: {
          ab_variant?: string | null
          attempts?: number
          campaign_id?: string
          chat_id?: string | null
          created_at?: string
          current_step_index?: number
          display_name?: string | null
          error_message?: string | null
          external_message_id?: string | null
          id?: string
          last_attempt_at?: string | null
          lead_id?: string | null
          lock_token?: string | null
          locked_at?: string | null
          next_retry_at?: string | null
          next_send_at?: string | null
          phone_digits?: string
          phone_number?: string
          responded_at?: string | null
          retry_count?: number
          sent_at?: string | null
          source_kind?: string
          source_payload?: Json
          status?: string
          stopped_at?: string | null
          stopped_reason?: string | null
          updated_at?: string
          whatsapp_check_status?: string
          whatsapp_checked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comm_whatsapp_campaign_targets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "comm_whatsapp_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_whatsapp_campaign_targets_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "comm_whatsapp_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_whatsapp_campaign_targets_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      comm_whatsapp_campaign_templates: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          steps: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          steps?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          steps?: Json
          updated_at?: string
        }
        Relationships: []
      }
      comm_whatsapp_campaign_worker_runs: {
        Row: {
          action: string
          campaign_id: string | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          failed: number
          finished_at: string | null
          id: string
          processed: number
          sent: number
          source: string
          started_at: string
          status: string
          stopped: number
        }
        Insert: {
          action?: string
          campaign_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          failed?: number
          finished_at?: string | null
          id?: string
          processed?: number
          sent?: number
          source?: string
          started_at?: string
          status?: string
          stopped?: number
        }
        Update: {
          action?: string
          campaign_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          failed?: number
          finished_at?: string | null
          id?: string
          processed?: number
          sent?: number
          source?: string
          started_at?: string
          status?: string
          stopped?: number
        }
        Relationships: [
          {
            foreignKeyName: "comm_whatsapp_campaign_worker_runs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "comm_whatsapp_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      comm_whatsapp_campaigns: {
        Row: {
          ab_split_percent: number
          ab_test_enabled: boolean
          active_weekdays: number[]
          audience_config: Json
          audience_source: string
          completed_at: string | null
          create_leads_from_csv: boolean
          created_at: string
          created_by: string | null
          daily_send_limit: number | null
          failed_targets: number
          id: string
          invalid_targets: number
          last_error: string | null
          message_text: string
          name: string
          objective: string | null
          pacing_per_minute: number
          pending_targets: number
          recurrence_end_at: string | null
          recurrence_interval: number
          recurrence_next_run_at: string | null
          recurrence_rule: string
          recurrence_runs_completed: number
          responded_targets: number
          scheduled_at: string | null
          send_window_end: string | null
          send_window_start: string | null
          sent_targets: number
          started_at: string | null
          status: string
          stop_on_reply: boolean
          stopped_targets: number
          total_targets: number
          updated_at: string
          valid_targets: number
          validate_whatsapp_numbers: boolean
        }
        Insert: {
          ab_split_percent?: number
          ab_test_enabled?: boolean
          active_weekdays?: number[]
          audience_config?: Json
          audience_source?: string
          completed_at?: string | null
          create_leads_from_csv?: boolean
          created_at?: string
          created_by?: string | null
          daily_send_limit?: number | null
          failed_targets?: number
          id?: string
          invalid_targets?: number
          last_error?: string | null
          message_text?: string
          name: string
          objective?: string | null
          pacing_per_minute?: number
          pending_targets?: number
          recurrence_end_at?: string | null
          recurrence_interval?: number
          recurrence_next_run_at?: string | null
          recurrence_rule?: string
          recurrence_runs_completed?: number
          responded_targets?: number
          scheduled_at?: string | null
          send_window_end?: string | null
          send_window_start?: string | null
          sent_targets?: number
          started_at?: string | null
          status?: string
          stop_on_reply?: boolean
          stopped_targets?: number
          total_targets?: number
          updated_at?: string
          valid_targets?: number
          validate_whatsapp_numbers?: boolean
        }
        Update: {
          ab_split_percent?: number
          ab_test_enabled?: boolean
          active_weekdays?: number[]
          audience_config?: Json
          audience_source?: string
          completed_at?: string | null
          create_leads_from_csv?: boolean
          created_at?: string
          created_by?: string | null
          daily_send_limit?: number | null
          failed_targets?: number
          id?: string
          invalid_targets?: number
          last_error?: string | null
          message_text?: string
          name?: string
          objective?: string | null
          pacing_per_minute?: number
          pending_targets?: number
          recurrence_end_at?: string | null
          recurrence_interval?: number
          recurrence_next_run_at?: string | null
          recurrence_rule?: string
          recurrence_runs_completed?: number
          responded_targets?: number
          scheduled_at?: string | null
          send_window_end?: string | null
          send_window_start?: string | null
          sent_targets?: number
          started_at?: string | null
          status?: string
          stop_on_reply?: boolean
          stopped_targets?: number
          total_targets?: number
          updated_at?: string
          valid_targets?: number
          validate_whatsapp_numbers?: boolean
        }
        Relationships: []
      }
      comm_whatsapp_channels: {
        Row: {
          connected_user_name: string | null
          connection_status: string
          created_at: string
          enabled: boolean
          health_snapshot: Json
          health_status: string
          id: string
          last_error: string | null
          last_health_check_at: string | null
          last_webhook_received_at: string | null
          limits_snapshot: Json
          name: string
          phone_number: string | null
          slug: string
          updated_at: string
          webhook_secret: string
          whapi_channel_id: string | null
        }
        Insert: {
          connected_user_name?: string | null
          connection_status?: string
          created_at?: string
          enabled?: boolean
          health_snapshot?: Json
          health_status?: string
          id?: string
          last_error?: string | null
          last_health_check_at?: string | null
          last_webhook_received_at?: string | null
          limits_snapshot?: Json
          name?: string
          phone_number?: string | null
          slug: string
          updated_at?: string
          webhook_secret?: string
          whapi_channel_id?: string | null
        }
        Update: {
          connected_user_name?: string | null
          connection_status?: string
          created_at?: string
          enabled?: boolean
          health_snapshot?: Json
          health_status?: string
          id?: string
          last_error?: string | null
          last_health_check_at?: string | null
          last_webhook_received_at?: string | null
          limits_snapshot?: Json
          name?: string
          phone_number?: string | null
          slug?: string
          updated_at?: string
          webhook_secret?: string
          whapi_channel_id?: string | null
        }
        Relationships: []
      }
      comm_whatsapp_chat_identifiers: {
        Row: {
          channel_id: string
          chat_id: string
          created_at: string
          evidence: Json
          external_chat_id: string
          identifier_kind: string
          is_verified: boolean
          last_confirmed_at: string
          last_observed_at: string
          source: string
        }
        Insert: {
          channel_id: string
          chat_id: string
          created_at?: string
          evidence?: Json
          external_chat_id: string
          identifier_kind: string
          is_verified?: boolean
          last_confirmed_at?: string
          last_observed_at?: string
          source?: string
        }
        Update: {
          channel_id?: string
          chat_id?: string
          created_at?: string
          evidence?: Json
          external_chat_id?: string
          identifier_kind?: string
          is_verified?: boolean
          last_confirmed_at?: string
          last_observed_at?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "comm_whatsapp_chat_identifiers_channel_chat_fkey"
            columns: ["chat_id", "channel_id"]
            isOneToOne: false
            referencedRelation: "comm_whatsapp_chats"
            referencedColumns: ["id", "channel_id"]
          },
          {
            foreignKeyName: "comm_whatsapp_chat_identifiers_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "comm_whatsapp_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_whatsapp_chat_identifiers_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "comm_whatsapp_chats"
            referencedColumns: ["id"]
          },
        ]
      }
      comm_whatsapp_chat_merge_log: {
        Row: {
          channel_id: string
          created_at: string
          id: string
          loser_before: Json
          loser_chat_id: string
          mapping_evidence: Json
          moved_counts: Json
          reason: string
          run_id: string
          winner_before: Json
          winner_chat_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          id?: string
          loser_before: Json
          loser_chat_id: string
          mapping_evidence?: Json
          moved_counts?: Json
          reason: string
          run_id?: string
          winner_before: Json
          winner_chat_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          id?: string
          loser_before?: Json
          loser_chat_id?: string
          mapping_evidence?: Json
          moved_counts?: Json
          reason?: string
          run_id?: string
          winner_before?: Json
          winner_chat_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comm_whatsapp_chat_merge_log_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "comm_whatsapp_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_whatsapp_chat_merge_log_loser_channel_fkey"
            columns: ["loser_chat_id", "channel_id"]
            isOneToOne: false
            referencedRelation: "comm_whatsapp_chats"
            referencedColumns: ["id", "channel_id"]
          },
          {
            foreignKeyName: "comm_whatsapp_chat_merge_log_loser_chat_id_fkey"
            columns: ["loser_chat_id"]
            isOneToOne: false
            referencedRelation: "comm_whatsapp_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_whatsapp_chat_merge_log_winner_channel_fkey"
            columns: ["winner_chat_id", "channel_id"]
            isOneToOne: false
            referencedRelation: "comm_whatsapp_chats"
            referencedColumns: ["id", "channel_id"]
          },
          {
            foreignKeyName: "comm_whatsapp_chat_merge_log_winner_chat_id_fkey"
            columns: ["winner_chat_id"]
            isOneToOne: false
            referencedRelation: "comm_whatsapp_chats"
            referencedColumns: ["id"]
          },
        ]
      }
      comm_whatsapp_chats: {
        Row: {
          archived_at: string | null
          auto_link_blocked: boolean
          autonomous_attendance_status: string
          channel_id: string
          created_at: string
          deleted_at: string | null
          display_name: string
          external_chat_id: string
          id: string
          identity_conflict: boolean
          is_archived: boolean
          is_muted: boolean
          is_pinned: boolean
          last_message_at: string | null
          last_message_delivery_status: string | null
          last_message_direction: string
          last_message_status_updated_at: string | null
          last_message_text: string | null
          last_read_at: string | null
          lead_id: string | null
          lead_link_source: string | null
          lead_linked_at: string | null
          lead_linked_by: string | null
          manual_unread: boolean
          manual_unread_at: string | null
          merged_into_chat_id: string | null
          muted_at: string | null
          phone_digits: string
          phone_number: string
          pinned_at: string | null
          push_name: string | null
          saved_contact_name: string | null
          status: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          auto_link_blocked?: boolean
          autonomous_attendance_status?: string
          channel_id: string
          created_at?: string
          deleted_at?: string | null
          display_name: string
          external_chat_id: string
          id?: string
          identity_conflict?: boolean
          is_archived?: boolean
          is_muted?: boolean
          is_pinned?: boolean
          last_message_at?: string | null
          last_message_delivery_status?: string | null
          last_message_direction?: string
          last_message_status_updated_at?: string | null
          last_message_text?: string | null
          last_read_at?: string | null
          lead_id?: string | null
          lead_link_source?: string | null
          lead_linked_at?: string | null
          lead_linked_by?: string | null
          manual_unread?: boolean
          manual_unread_at?: string | null
          merged_into_chat_id?: string | null
          muted_at?: string | null
          phone_digits: string
          phone_number: string
          pinned_at?: string | null
          push_name?: string | null
          saved_contact_name?: string | null
          status?: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          auto_link_blocked?: boolean
          autonomous_attendance_status?: string
          channel_id?: string
          created_at?: string
          deleted_at?: string | null
          display_name?: string
          external_chat_id?: string
          id?: string
          identity_conflict?: boolean
          is_archived?: boolean
          is_muted?: boolean
          is_pinned?: boolean
          last_message_at?: string | null
          last_message_delivery_status?: string | null
          last_message_direction?: string
          last_message_status_updated_at?: string | null
          last_message_text?: string | null
          last_read_at?: string | null
          lead_id?: string | null
          lead_link_source?: string | null
          lead_linked_at?: string | null
          lead_linked_by?: string | null
          manual_unread?: boolean
          manual_unread_at?: string | null
          merged_into_chat_id?: string | null
          muted_at?: string | null
          phone_digits?: string
          phone_number?: string
          pinned_at?: string | null
          push_name?: string | null
          saved_contact_name?: string | null
          status?: string
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comm_whatsapp_chats_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "comm_whatsapp_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_whatsapp_chats_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_whatsapp_chats_merged_into_channel_fkey"
            columns: ["merged_into_chat_id", "channel_id"]
            isOneToOne: false
            referencedRelation: "comm_whatsapp_chats"
            referencedColumns: ["id", "channel_id"]
          },
        ]
      }
      comm_whatsapp_commercial_state: {
        Row: {
          analysis_confidence: number | null
          blocker: string
          buying_signals: Json
          chat_id: string
          contact_role: string
          created_at: string
          decision_maker: string | null
          id: string
          known_facts: Json
          last_commercial_event: string | null
          last_commercial_function: string | null
          last_commitment: Json | null
          last_customer_position: string | null
          last_strategy_summary: string | null
          lead_id: string | null
          lead_temperature: string
          main_commercial_question: string | null
          next_action_owner: string
          objections: Json
          pending_microdecision: string | null
          previous_microdecision: string | null
          source_last_message_at: string | null
          source_last_message_id: string | null
          stage: string
          stakeholders: Json
          updated_at: string
        }
        Insert: {
          analysis_confidence?: number | null
          blocker?: string
          buying_signals?: Json
          chat_id: string
          contact_role?: string
          created_at?: string
          decision_maker?: string | null
          id?: string
          known_facts?: Json
          last_commercial_event?: string | null
          last_commercial_function?: string | null
          last_commitment?: Json | null
          last_customer_position?: string | null
          last_strategy_summary?: string | null
          lead_id?: string | null
          lead_temperature?: string
          main_commercial_question?: string | null
          next_action_owner?: string
          objections?: Json
          pending_microdecision?: string | null
          previous_microdecision?: string | null
          source_last_message_at?: string | null
          source_last_message_id?: string | null
          stage?: string
          stakeholders?: Json
          updated_at?: string
        }
        Update: {
          analysis_confidence?: number | null
          blocker?: string
          buying_signals?: Json
          chat_id?: string
          contact_role?: string
          created_at?: string
          decision_maker?: string | null
          id?: string
          known_facts?: Json
          last_commercial_event?: string | null
          last_commercial_function?: string | null
          last_commitment?: Json | null
          last_customer_position?: string | null
          last_strategy_summary?: string | null
          lead_id?: string | null
          lead_temperature?: string
          main_commercial_question?: string | null
          next_action_owner?: string
          objections?: Json
          pending_microdecision?: string | null
          previous_microdecision?: string | null
          source_last_message_at?: string | null
          source_last_message_id?: string | null
          stage?: string
          stakeholders?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comm_whatsapp_commercial_state_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "comm_whatsapp_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_whatsapp_commercial_state_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      comm_whatsapp_enrichment_jobs: {
        Row: {
          attempts: number
          channel_id: string
          chat_id: string | null
          completed_at: string | null
          created_at: string
          dedupe_key: string
          id: string
          kind: string
          last_error: string | null
          lock_token: string | null
          locked_at: string | null
          message_id: string | null
          next_attempt_at: string
          payload: Json
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          channel_id: string
          chat_id?: string | null
          completed_at?: string | null
          created_at?: string
          dedupe_key: string
          id?: string
          kind: string
          last_error?: string | null
          lock_token?: string | null
          locked_at?: string | null
          message_id?: string | null
          next_attempt_at?: string
          payload?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          channel_id?: string
          chat_id?: string | null
          completed_at?: string | null
          created_at?: string
          dedupe_key?: string
          id?: string
          kind?: string
          last_error?: string | null
          lock_token?: string | null
          locked_at?: string | null
          message_id?: string | null
          next_attempt_at?: string
          payload?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comm_whatsapp_enrichment_jobs_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "comm_whatsapp_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_whatsapp_enrichment_jobs_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "comm_whatsapp_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_whatsapp_enrichment_jobs_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "comm_whatsapp_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      comm_whatsapp_event_receipts: {
        Row: {
          channel_id: string
          event_key: string
          event_type: string
          id: string
          payload_archive_path: string | null
          received_at: string
          resource_id: string | null
          summary: Json
        }
        Insert: {
          channel_id: string
          event_key: string
          event_type: string
          id?: string
          payload_archive_path?: string | null
          received_at?: string
          resource_id?: string | null
          summary?: Json
        }
        Update: {
          channel_id?: string
          event_key?: string
          event_type?: string
          id?: string
          payload_archive_path?: string | null
          received_at?: string
          resource_id?: string | null
          summary?: Json
        }
        Relationships: [
          {
            foreignKeyName: "comm_whatsapp_event_receipts_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "comm_whatsapp_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      comm_whatsapp_identity_conflicts: {
        Row: {
          channel_id: string
          chat_id: string | null
          conflict_type: string
          created_at: string
          dedupe_key: string
          details: Json
          id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          channel_id: string
          chat_id?: string | null
          conflict_type: string
          created_at?: string
          dedupe_key: string
          details?: Json
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          channel_id?: string
          chat_id?: string | null
          conflict_type?: string
          created_at?: string
          dedupe_key?: string
          details?: Json
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comm_whatsapp_identity_conflicts_channel_chat_fkey"
            columns: ["chat_id", "channel_id"]
            isOneToOne: false
            referencedRelation: "comm_whatsapp_chats"
            referencedColumns: ["id", "channel_id"]
          },
          {
            foreignKeyName: "comm_whatsapp_identity_conflicts_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "comm_whatsapp_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_whatsapp_identity_conflicts_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "comm_whatsapp_chats"
            referencedColumns: ["id"]
          },
        ]
      }
      comm_whatsapp_messages: {
        Row: {
          channel_id: string
          chat_id: string
          created_at: string
          created_by: string | null
          delivery_status: string
          direction: string
          error_message: string | null
          external_message_id: string | null
          id: string
          media_caption: string | null
          media_duration_seconds: number | null
          media_file_name: string | null
          media_id: string | null
          media_mime_type: string | null
          media_size_bytes: number | null
          media_url: string | null
          message_at: string
          message_type: string
          metadata: Json
          sender_name: string | null
          sender_phone: string | null
          source: string | null
          status_updated_at: string | null
          text_content: string | null
          transcription_error: string | null
          transcription_model: string | null
          transcription_provider: string | null
          transcription_requested_by: string | null
          transcription_status: string
          transcription_text: string | null
          transcription_updated_at: string | null
        }
        Insert: {
          channel_id: string
          chat_id: string
          created_at?: string
          created_by?: string | null
          delivery_status?: string
          direction: string
          error_message?: string | null
          external_message_id?: string | null
          id?: string
          media_caption?: string | null
          media_duration_seconds?: number | null
          media_file_name?: string | null
          media_id?: string | null
          media_mime_type?: string | null
          media_size_bytes?: number | null
          media_url?: string | null
          message_at: string
          message_type?: string
          metadata?: Json
          sender_name?: string | null
          sender_phone?: string | null
          source?: string | null
          status_updated_at?: string | null
          text_content?: string | null
          transcription_error?: string | null
          transcription_model?: string | null
          transcription_provider?: string | null
          transcription_requested_by?: string | null
          transcription_status?: string
          transcription_text?: string | null
          transcription_updated_at?: string | null
        }
        Update: {
          channel_id?: string
          chat_id?: string
          created_at?: string
          created_by?: string | null
          delivery_status?: string
          direction?: string
          error_message?: string | null
          external_message_id?: string | null
          id?: string
          media_caption?: string | null
          media_duration_seconds?: number | null
          media_file_name?: string | null
          media_id?: string | null
          media_mime_type?: string | null
          media_size_bytes?: number | null
          media_url?: string | null
          message_at?: string
          message_type?: string
          metadata?: Json
          sender_name?: string | null
          sender_phone?: string | null
          source?: string | null
          status_updated_at?: string | null
          text_content?: string | null
          transcription_error?: string | null
          transcription_model?: string | null
          transcription_provider?: string | null
          transcription_requested_by?: string | null
          transcription_status?: string
          transcription_text?: string | null
          transcription_updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comm_whatsapp_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "comm_whatsapp_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_whatsapp_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "comm_whatsapp_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_whatsapp_messages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_whatsapp_messages_transcription_requested_by_fkey"
            columns: ["transcription_requested_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comm_whatsapp_messages_archive: {
        Row: {
          archived_at: string
          channel_id: string
          chat_id: string
          created_at: string
          created_by: string | null
          delivery_status: string
          direction: string
          error_message: string | null
          external_message_id: string | null
          id: string
          media_caption: string | null
          media_duration_seconds: number | null
          media_file_name: string | null
          media_id: string | null
          media_mime_type: string | null
          media_size_bytes: number | null
          media_url: string | null
          message_at: string
          message_type: string
          metadata: Json
          sender_name: string | null
          sender_phone: string | null
          source: string | null
          status_updated_at: string | null
          text_content: string | null
          transcription_error: string | null
          transcription_model: string | null
          transcription_provider: string | null
          transcription_requested_by: string | null
          transcription_status: string
          transcription_text: string | null
          transcription_updated_at: string | null
        }
        Insert: {
          archived_at?: string
          channel_id: string
          chat_id: string
          created_at?: string
          created_by?: string | null
          delivery_status?: string
          direction: string
          error_message?: string | null
          external_message_id?: string | null
          id?: string
          media_caption?: string | null
          media_duration_seconds?: number | null
          media_file_name?: string | null
          media_id?: string | null
          media_mime_type?: string | null
          media_size_bytes?: number | null
          media_url?: string | null
          message_at: string
          message_type?: string
          metadata?: Json
          sender_name?: string | null
          sender_phone?: string | null
          source?: string | null
          status_updated_at?: string | null
          text_content?: string | null
          transcription_error?: string | null
          transcription_model?: string | null
          transcription_provider?: string | null
          transcription_requested_by?: string | null
          transcription_status?: string
          transcription_text?: string | null
          transcription_updated_at?: string | null
        }
        Update: {
          archived_at?: string
          channel_id?: string
          chat_id?: string
          created_at?: string
          created_by?: string | null
          delivery_status?: string
          direction?: string
          error_message?: string | null
          external_message_id?: string | null
          id?: string
          media_caption?: string | null
          media_duration_seconds?: number | null
          media_file_name?: string | null
          media_id?: string | null
          media_mime_type?: string | null
          media_size_bytes?: number | null
          media_url?: string | null
          message_at?: string
          message_type?: string
          metadata?: Json
          sender_name?: string | null
          sender_phone?: string | null
          source?: string | null
          status_updated_at?: string | null
          text_content?: string | null
          transcription_error?: string | null
          transcription_model?: string | null
          transcription_provider?: string | null
          transcription_requested_by?: string | null
          transcription_status?: string
          transcription_text?: string | null
          transcription_updated_at?: string | null
        }
        Relationships: []
      }
      comm_whatsapp_opt_outs: {
        Row: {
          ai_suggestion_id: string | null
          created_at: string
          created_by: string | null
          id: string
          lead_id: string | null
          phone_digits: string
          phone_number: string | null
          reason: string | null
          source: string
          source_campaign_id: string | null
          source_chat_id: string | null
          source_message_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          ai_suggestion_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string | null
          phone_digits: string
          phone_number?: string | null
          reason?: string | null
          source?: string
          source_campaign_id?: string | null
          source_chat_id?: string | null
          source_message_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          ai_suggestion_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string | null
          phone_digits?: string
          phone_number?: string | null
          reason?: string | null
          source?: string
          source_campaign_id?: string | null
          source_chat_id?: string | null
          source_message_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comm_whatsapp_opt_outs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_whatsapp_opt_outs_source_campaign_id_fkey"
            columns: ["source_campaign_id"]
            isOneToOne: false
            referencedRelation: "comm_whatsapp_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_whatsapp_opt_outs_source_chat_id_fkey"
            columns: ["source_chat_id"]
            isOneToOne: false
            referencedRelation: "comm_whatsapp_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_whatsapp_opt_outs_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "comm_whatsapp_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      comm_whatsapp_pending_message_mutations: {
        Row: {
          channel_id: string
          created_at: string
          dedupe_key: string
          event_external_message_id: string | null
          id: string
          mutation_type: string
          occurred_at: string
          payload: Json
          target_external_message_id: string
          updated_at: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          dedupe_key: string
          event_external_message_id?: string | null
          id?: string
          mutation_type: string
          occurred_at: string
          payload?: Json
          target_external_message_id: string
          updated_at?: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          dedupe_key?: string
          event_external_message_id?: string | null
          id?: string
          mutation_type?: string
          occurred_at?: string
          payload?: Json
          target_external_message_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comm_whatsapp_pending_message_mutations_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "comm_whatsapp_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      comm_whatsapp_pending_message_statuses: {
        Row: {
          channel_id: string
          delivery_status: string
          error_message: string | null
          external_message_id: string
          id: string
          received_at: string
          status_updated_at: string
          updated_at: string
        }
        Insert: {
          channel_id: string
          delivery_status: string
          error_message?: string | null
          external_message_id: string
          id?: string
          received_at?: string
          status_updated_at?: string
          updated_at?: string
        }
        Update: {
          channel_id?: string
          delivery_status?: string
          error_message?: string | null
          external_message_id?: string
          id?: string
          received_at?: string
          status_updated_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comm_whatsapp_pending_message_statuses_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "comm_whatsapp_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      comm_whatsapp_phone_contacts_cache: {
        Row: {
          channel_id: string
          contact_id: string
          created_at: string
          display_name: string
          id: string
          last_synced_at: string
          phone_digits: string | null
          phone_number: string | null
          push_name: string | null
          saved: boolean
          short_name: string | null
          updated_at: string
        }
        Insert: {
          channel_id: string
          contact_id: string
          created_at?: string
          display_name: string
          id?: string
          last_synced_at?: string
          phone_digits?: string | null
          phone_number?: string | null
          push_name?: string | null
          saved?: boolean
          short_name?: string | null
          updated_at?: string
        }
        Update: {
          channel_id?: string
          contact_id?: string
          created_at?: string
          display_name?: string
          id?: string
          last_synced_at?: string
          phone_digits?: string | null
          phone_number?: string | null
          push_name?: string | null
          saved?: boolean
          short_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comm_whatsapp_phone_contacts_cache_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "comm_whatsapp_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      comm_whatsapp_send_requests: {
        Row: {
          channel_id: string
          client_request_id: string
          created_at: string
          delivery_status: string | null
          error_message: string | null
          external_message_id: string | null
          id: string
          payload: Json
          request_kind: string
          status: string
          updated_at: string
        }
        Insert: {
          channel_id: string
          client_request_id: string
          created_at?: string
          delivery_status?: string | null
          error_message?: string | null
          external_message_id?: string | null
          id?: string
          payload?: Json
          request_kind?: string
          status?: string
          updated_at?: string
        }
        Update: {
          channel_id?: string
          client_request_id?: string
          created_at?: string
          delivery_status?: string | null
          error_message?: string | null
          external_message_id?: string | null
          id?: string
          payload?: Json
          request_kind?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comm_whatsapp_send_requests_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "comm_whatsapp_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_abrangencias: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          description: string | null
          id: string
          label: string
          metadata: Json | null
          ordem: number | null
          updated_at: string | null
          value: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          label: string
          metadata?: Json | null
          ordem?: number | null
          updated_at?: string | null
          value: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          label?: string
          metadata?: Json | null
          ordem?: number | null
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      contract_acomodacoes: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          description: string | null
          id: string
          label: string
          metadata: Json | null
          ordem: number | null
          updated_at: string | null
          value: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          label: string
          metadata?: Json | null
          ordem?: number | null
          updated_at?: string | null
          value: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          label?: string
          metadata?: Json | null
          ordem?: number | null
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      contract_carencias: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          description: string | null
          id: string
          label: string
          metadata: Json | null
          ordem: number | null
          updated_at: string | null
          value: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          label: string
          metadata?: Json | null
          ordem?: number | null
          updated_at?: string | null
          value: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          label?: string
          metadata?: Json | null
          ordem?: number | null
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      contract_document_extraction_cache: {
        Row: {
          cache_key: string
          created_at: string
          expires_at: string
          extraction: Json
          id: string
          metadata: Json
          model: string
          parser_version: string
          prompt_version: string
        }
        Insert: {
          cache_key: string
          created_at?: string
          expires_at?: string
          extraction: Json
          id?: string
          metadata?: Json
          model: string
          parser_version: string
          prompt_version: string
        }
        Update: {
          cache_key?: string
          created_at?: string
          expires_at?: string
          extraction?: Json
          id?: string
          metadata?: Json
          model?: string
          parser_version?: string
          prompt_version?: string
        }
        Relationships: []
      }
      contract_document_extraction_runs: {
        Row: {
          administrator: string | null
          bundle_complete: boolean | null
          cache_hit: boolean
          cached_tokens: number | null
          candidate_pages_count: number
          created_at: string
          document_family: string
          document_roles: string[]
          document_type: string
          duration_ms: number
          estimated_cost_usd: number | null
          fallback_reason: string | null
          fields_ambiguous: number
          fields_conflicting: number
          fields_missing: number
          fields_resolved: number
          id: string
          input_tokens: number | null
          model: string | null
          number_of_files: number
          operator: string | null
          output_tokens: number | null
          pages_sent_to_llm: number
          parser_version: string
          prompt_version: string
          provider: string | null
          reasoning_tokens: number | null
          retry_count: number
          support_status: string
          text_extraction_success: boolean
          text_quality: string
          total_pages: number
          total_tokens: number | null
          used_llm: boolean
          used_vision: boolean
        }
        Insert: {
          administrator?: string | null
          bundle_complete?: boolean | null
          cache_hit?: boolean
          cached_tokens?: number | null
          candidate_pages_count: number
          created_at?: string
          document_family: string
          document_roles?: string[]
          document_type: string
          duration_ms: number
          estimated_cost_usd?: number | null
          fallback_reason?: string | null
          fields_ambiguous?: number
          fields_conflicting?: number
          fields_missing?: number
          fields_resolved?: number
          id?: string
          input_tokens?: number | null
          model?: string | null
          number_of_files: number
          operator?: string | null
          output_tokens?: number | null
          pages_sent_to_llm?: number
          parser_version: string
          prompt_version: string
          provider?: string | null
          reasoning_tokens?: number | null
          retry_count?: number
          support_status: string
          text_extraction_success: boolean
          text_quality: string
          total_pages: number
          total_tokens?: number | null
          used_llm?: boolean
          used_vision?: boolean
        }
        Update: {
          administrator?: string | null
          bundle_complete?: boolean | null
          cache_hit?: boolean
          cached_tokens?: number | null
          candidate_pages_count?: number
          created_at?: string
          document_family?: string
          document_roles?: string[]
          document_type?: string
          duration_ms?: number
          estimated_cost_usd?: number | null
          fallback_reason?: string | null
          fields_ambiguous?: number
          fields_conflicting?: number
          fields_missing?: number
          fields_resolved?: number
          id?: string
          input_tokens?: number | null
          model?: string | null
          number_of_files?: number
          operator?: string | null
          output_tokens?: number | null
          pages_sent_to_llm?: number
          parser_version?: string
          prompt_version?: string
          provider?: string | null
          reasoning_tokens?: number | null
          retry_count?: number
          support_status?: string
          text_extraction_success?: boolean
          text_quality?: string
          total_pages?: number
          total_tokens?: number | null
          used_llm?: boolean
          used_vision?: boolean
        }
        Relationships: []
      }
      contract_holders: {
        Row: {
          bairro: string | null
          bonus_por_vida_aplicado: boolean | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          cns: string | null
          complemento: string | null
          contract_id: string
          cpf: string
          created_at: string | null
          data_abertura_cnpj: string | null
          data_nascimento: string
          email: string | null
          endereco: string | null
          estado: string | null
          estado_civil: string | null
          id: string
          nome_completo: string
          nome_fantasia: string | null
          numero: string | null
          percentual_societario: number | null
          razao_social: string | null
          rg: string | null
          sexo: string | null
          telefone: string
          updated_at: string | null
        }
        Insert: {
          bairro?: string | null
          bonus_por_vida_aplicado?: boolean | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          cns?: string | null
          complemento?: string | null
          contract_id: string
          cpf: string
          created_at?: string | null
          data_abertura_cnpj?: string | null
          data_nascimento: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          estado_civil?: string | null
          id?: string
          nome_completo: string
          nome_fantasia?: string | null
          numero?: string | null
          percentual_societario?: number | null
          razao_social?: string | null
          rg?: string | null
          sexo?: string | null
          telefone: string
          updated_at?: string | null
        }
        Update: {
          bairro?: string | null
          bonus_por_vida_aplicado?: boolean | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          cns?: string | null
          complemento?: string | null
          contract_id?: string
          cpf?: string
          created_at?: string | null
          data_abertura_cnpj?: string | null
          data_nascimento?: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          estado_civil?: string | null
          id?: string
          nome_completo?: string
          nome_fantasia?: string | null
          numero?: string | null
          percentual_societario?: number | null
          razao_social?: string | null
          rg?: string | null
          sexo?: string | null
          telefone?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_holders_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_modalidades: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          description: string | null
          id: string
          label: string
          metadata: Json | null
          ordem: number | null
          updated_at: string | null
          value: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          label: string
          metadata?: Json | null
          ordem?: number | null
          updated_at?: string | null
          value: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          label?: string
          metadata?: Json | null
          ordem?: number | null
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      contract_status_config: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          description: string | null
          id: string
          label: string
          metadata: Json | null
          ordem: number | null
          updated_at: string | null
          value: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          label: string
          metadata?: Json | null
          ordem?: number | null
          updated_at?: string | null
          value: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          label?: string
          metadata?: Json | null
          ordem?: number | null
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      contract_value_adjustments: {
        Row: {
          contract_id: string
          created_at: string | null
          created_by: string
          id: string
          motivo: string
          tipo: string
          valor: number
        }
        Insert: {
          contract_id: string
          created_at?: string | null
          created_by: string
          id?: string
          motivo: string
          tipo: string
          valor: number
        }
        Update: {
          contract_id?: string
          created_at?: string | null
          created_by?: string
          id?: string
          motivo?: string
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "contract_value_adjustments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          abrangencia: string | null
          acomodacao: string | null
          bonus_por_vida_aplicado: boolean | null
          bonus_por_vida_configuracoes: Json | null
          bonus_por_vida_valor: number | null
          carencia: string | null
          cnpj: string | null
          codigo_contrato: string
          comissao_multiplicador: number | null
          comissao_parcelas: Json | null
          comissao_prevista: number | null
          comissao_recebimento_adiantado: boolean | null
          created_at: string | null
          data_inicio: string | null
          data_renovacao: string | null
          endereco_empresa: string | null
          id: string
          lead_id: string | null
          mensalidade_total: number | null
          mes_reajuste: number | null
          modalidade: string
          nome_fantasia: string | null
          observacoes_internas: string | null
          operadora: string
          previsao_pagamento_bonificacao: string | null
          previsao_recebimento_comissao: string | null
          produto_plano: string
          razao_social: string | null
          responsavel: string
          status: string
          taxa_adesao_percentual: number | null
          taxa_adesao_tipo: string | null
          taxa_adesao_valor: number | null
          updated_at: string | null
          vidas: number | null
          vidas_elegiveis_bonus: number | null
        }
        Insert: {
          abrangencia?: string | null
          acomodacao?: string | null
          bonus_por_vida_aplicado?: boolean | null
          bonus_por_vida_configuracoes?: Json | null
          bonus_por_vida_valor?: number | null
          carencia?: string | null
          cnpj?: string | null
          codigo_contrato: string
          comissao_multiplicador?: number | null
          comissao_parcelas?: Json | null
          comissao_prevista?: number | null
          comissao_recebimento_adiantado?: boolean | null
          created_at?: string | null
          data_inicio?: string | null
          data_renovacao?: string | null
          endereco_empresa?: string | null
          id?: string
          lead_id?: string | null
          mensalidade_total?: number | null
          mes_reajuste?: number | null
          modalidade: string
          nome_fantasia?: string | null
          observacoes_internas?: string | null
          operadora: string
          previsao_pagamento_bonificacao?: string | null
          previsao_recebimento_comissao?: string | null
          produto_plano: string
          razao_social?: string | null
          responsavel: string
          status?: string
          taxa_adesao_percentual?: number | null
          taxa_adesao_tipo?: string | null
          taxa_adesao_valor?: number | null
          updated_at?: string | null
          vidas?: number | null
          vidas_elegiveis_bonus?: number | null
        }
        Update: {
          abrangencia?: string | null
          acomodacao?: string | null
          bonus_por_vida_aplicado?: boolean | null
          bonus_por_vida_configuracoes?: Json | null
          bonus_por_vida_valor?: number | null
          carencia?: string | null
          cnpj?: string | null
          codigo_contrato?: string
          comissao_multiplicador?: number | null
          comissao_parcelas?: Json | null
          comissao_prevista?: number | null
          comissao_recebimento_adiantado?: boolean | null
          created_at?: string | null
          data_inicio?: string | null
          data_renovacao?: string | null
          endereco_empresa?: string | null
          id?: string
          lead_id?: string | null
          mensalidade_total?: number | null
          mes_reajuste?: number | null
          modalidade?: string
          nome_fantasia?: string | null
          observacoes_internas?: string | null
          operadora?: string
          previsao_pagamento_bonificacao?: string | null
          previsao_recebimento_comissao?: string | null
          produto_plano?: string
          razao_social?: string | null
          responsavel?: string
          status?: string
          taxa_adesao_percentual?: number | null
          taxa_adesao_tipo?: string | null
          taxa_adesao_valor?: number | null
          updated_at?: string | null
          vidas?: number | null
          vidas_elegiveis_bonus?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      dependents: {
        Row: {
          bonus_por_vida_aplicado: boolean | null
          carencia_individual: string | null
          contract_id: string
          cpf: string | null
          created_at: string | null
          data_nascimento: string
          elegibilidade: string | null
          holder_id: string
          id: string
          nome_completo: string
          relacao: string
          updated_at: string | null
          valor_individual: number | null
        }
        Insert: {
          bonus_por_vida_aplicado?: boolean | null
          carencia_individual?: string | null
          contract_id: string
          cpf?: string | null
          created_at?: string | null
          data_nascimento: string
          elegibilidade?: string | null
          holder_id: string
          id?: string
          nome_completo: string
          relacao: string
          updated_at?: string | null
          valor_individual?: number | null
        }
        Update: {
          bonus_por_vida_aplicado?: boolean | null
          carencia_individual?: string | null
          contract_id?: string
          cpf?: string | null
          created_at?: string | null
          data_nascimento?: string
          elegibilidade?: string | null
          holder_id?: string
          id?: string
          nome_completo?: string
          relacao?: string
          updated_at?: string | null
          valor_individual?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dependents_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dependents_holder_id_fkey"
            columns: ["holder_id"]
            isOneToOne: false
            referencedRelation: "contract_holders"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string | null
          entity_id: string
          entity_type: string
          id: string
          nome_arquivo: string
          tamanho_bytes: number | null
          tipo_documento: string
          url_arquivo: string
        }
        Insert: {
          created_at?: string | null
          entity_id: string
          entity_type: string
          id?: string
          nome_arquivo: string
          tamanho_bytes?: number | null
          tipo_documento: string
          url_arquivo: string
        }
        Update: {
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          nome_arquivo?: string
          tamanho_bytes?: number | null
          tipo_documento?: string
          url_arquivo?: string
        }
        Relationships: []
      }
      integration_settings: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          settings: Json | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          settings?: Json | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          settings?: Json | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      interactions: {
        Row: {
          contract_id: string | null
          created_at: string | null
          data_interacao: string | null
          descricao: string
          id: string
          lead_id: string | null
          responsavel: string
          tipo: string
        }
        Insert: {
          contract_id?: string | null
          created_at?: string | null
          data_interacao?: string | null
          descricao: string
          id?: string
          lead_id?: string | null
          responsavel: string
          tipo: string
        }
        Update: {
          contract_id?: string | null
          created_at?: string | null
          data_interacao?: string | null
          descricao?: string
          id?: string
          lead_id?: string | null
          responsavel?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "interactions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_origens: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          id: string
          nome: string
          visivel_para_observadores: boolean | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          nome: string
          visivel_para_observadores?: boolean | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          nome?: string
          visivel_para_observadores?: boolean | null
        }
        Relationships: []
      }
      lead_processing_cursor: {
        Row: {
          batch_size: number | null
          created_at: string | null
          id: number
          is_running: boolean | null
          last_error: string | null
          last_processed_at: string | null
          last_processed_phone: string | null
          reset_count: number | null
          total_processed: number | null
          updated_at: string | null
        }
        Insert: {
          batch_size?: number | null
          created_at?: string | null
          id?: number
          is_running?: boolean | null
          last_error?: string | null
          last_processed_at?: string | null
          last_processed_phone?: string | null
          reset_count?: number | null
          total_processed?: number | null
          updated_at?: string | null
        }
        Update: {
          batch_size?: number | null
          created_at?: string | null
          id?: number
          is_running?: boolean | null
          last_error?: string | null
          last_processed_at?: string | null
          last_processed_phone?: string | null
          reset_count?: number | null
          total_processed?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      lead_responsaveis: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          description: string | null
          id: string
          label: string
          metadata: Json | null
          ordem: number | null
          updated_at: string | null
          value: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          label: string
          metadata?: Json | null
          ordem?: number | null
          updated_at?: string | null
          value: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          label?: string
          metadata?: Json | null
          ordem?: number | null
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      lead_status_config: {
        Row: {
          ativo: boolean | null
          cor: string | null
          created_at: string | null
          id: string
          nome: string
          ordem: number | null
          padrao: boolean | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          cor?: string | null
          created_at?: string | null
          id?: string
          nome: string
          ordem?: number | null
          padrao?: boolean | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          cor?: string | null
          created_at?: string | null
          id?: string
          nome?: string
          ordem?: number | null
          padrao?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      lead_status_history: {
        Row: {
          created_at: string | null
          id: string
          lead_id: string
          observacao: string | null
          responsavel: string
          status_anterior: string
          status_novo: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          lead_id: string
          observacao?: string | null
          responsavel: string
          status_anterior: string
          status_novo: string
        }
        Update: {
          created_at?: string | null
          id?: string
          lead_id?: string
          observacao?: string | null
          responsavel?: string
          status_anterior?: string
          status_novo?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_status_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_tipos_contratacao: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          description: string | null
          id: string
          label: string
          metadata: Json | null
          ordem: number | null
          updated_at: string | null
          value: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          label: string
          metadata?: Json | null
          ordem?: number | null
          updated_at?: string | null
          value: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          label?: string
          metadata?: Json | null
          ordem?: number | null
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          arquivado: boolean | null
          auto_message_attempts: number | null
          auto_message_sent_at: string | null
          blackout_dates: string[] | null
          canal: string | null
          cep: string | null
          cidade: string | null
          created_at: string | null
          creation_source: string
          daily_send_limit: number | null
          data_criacao: string | null
          email: string | null
          endereco: string | null
          estado: string | null
          favorito: boolean
          id: string
          nome_completo: string
          numero_tentativas_reativacao: number
          observacoes: string | null
          operadora_atual: string | null
          origem_id: string
          processing_notes: string | null
          proximo_retorno: string | null
          push_notified_at: string | null
          reativacao_habilitada: boolean
          regiao: string | null
          responsavel_id: string
          skip_automation: boolean | null
          status: string
          status_id: string
          telefone: string
          tipo_contratacao_id: string
          ultima_tentativa_reativacao: string | null
          ultimo_contato: string | null
          updated_at: string | null
        }
        Insert: {
          arquivado?: boolean | null
          auto_message_attempts?: number | null
          auto_message_sent_at?: string | null
          blackout_dates?: string[] | null
          canal?: string | null
          cep?: string | null
          cidade?: string | null
          created_at?: string | null
          creation_source?: string
          daily_send_limit?: number | null
          data_criacao?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          favorito?: boolean
          id?: string
          nome_completo: string
          numero_tentativas_reativacao?: number
          observacoes?: string | null
          operadora_atual?: string | null
          origem_id: string
          processing_notes?: string | null
          proximo_retorno?: string | null
          push_notified_at?: string | null
          reativacao_habilitada?: boolean
          regiao?: string | null
          responsavel_id: string
          skip_automation?: boolean | null
          status?: string
          status_id: string
          telefone: string
          tipo_contratacao_id: string
          ultima_tentativa_reativacao?: string | null
          ultimo_contato?: string | null
          updated_at?: string | null
        }
        Update: {
          arquivado?: boolean | null
          auto_message_attempts?: number | null
          auto_message_sent_at?: string | null
          blackout_dates?: string[] | null
          canal?: string | null
          cep?: string | null
          cidade?: string | null
          created_at?: string | null
          creation_source?: string
          daily_send_limit?: number | null
          data_criacao?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          favorito?: boolean
          id?: string
          nome_completo?: string
          numero_tentativas_reativacao?: number
          observacoes?: string | null
          operadora_atual?: string | null
          origem_id?: string
          processing_notes?: string | null
          proximo_retorno?: string | null
          push_notified_at?: string | null
          reativacao_habilitada?: boolean
          regiao?: string | null
          responsavel_id?: string
          skip_automation?: boolean | null
          status?: string
          status_id?: string
          telefone?: string
          tipo_contratacao_id?: string
          ultima_tentativa_reativacao?: string | null
          ultimo_contato?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_leads_origem"
            columns: ["origem_id"]
            isOneToOne: false
            referencedRelation: "lead_origens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_leads_responsavel"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "lead_responsaveis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_leads_status"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "lead_status_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_leads_tipo_contratacao"
            columns: ["tipo_contratacao_id"]
            isOneToOne: false
            referencedRelation: "lead_tipos_contratacao"
            referencedColumns: ["id"]
          },
        ]
      }
      operadoras: {
        Row: {
          ativo: boolean | null
          bonus_padrao: number | null
          bonus_por_vida: boolean | null
          comissao_padrao: number | null
          created_at: string | null
          id: string
          nome: string
          observacoes: string | null
          prazo_recebimento_dias: number | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          bonus_padrao?: number | null
          bonus_por_vida?: boolean | null
          comissao_padrao?: number | null
          created_at?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          prazo_recebimento_dias?: number | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          bonus_padrao?: number | null
          bonus_por_vida?: boolean | null
          comissao_padrao?: number | null
          created_at?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          prazo_recebimento_dias?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      produtos_planos: {
        Row: {
          abrangencia: string | null
          acomodacao: string | null
          ativo: boolean | null
          bonus_por_vida_valor: number | null
          comissao_sugerida: number | null
          created_at: string | null
          id: string
          modalidade: string | null
          nome: string
          operadora_id: string | null
          updated_at: string | null
        }
        Insert: {
          abrangencia?: string | null
          acomodacao?: string | null
          ativo?: boolean | null
          bonus_por_vida_valor?: number | null
          comissao_sugerida?: number | null
          created_at?: string | null
          id?: string
          modalidade?: string | null
          nome: string
          operadora_id?: string | null
          updated_at?: string | null
        }
        Update: {
          abrangencia?: string | null
          acomodacao?: string | null
          ativo?: boolean | null
          bonus_por_vida_valor?: number | null
          comissao_sugerida?: number | null
          created_at?: string | null
          id?: string
          modalidade?: string | null
          nome?: string
          operadora_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "produtos_planos_operadora_id_fkey"
            columns: ["operadora_id"]
            isOneToOne: false
            referencedRelation: "operadoras"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_permissions: {
        Row: {
          can_edit: boolean | null
          can_view: boolean | null
          created_at: string | null
          id: string
          module: string
          role: string
          updated_at: string | null
        }
        Insert: {
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          id?: string
          module: string
          role: string
          updated_at?: string | null
        }
        Update: {
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          id?: string
          module?: string
          role?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_permissions_role_fkey"
            columns: ["role"]
            isOneToOne: false
            referencedRelation: "access_profiles"
            referencedColumns: ["slug"]
          },
        ]
      }
      public_form_rate_limits: {
        Row: {
          ip_hash: string
          last_seen_at: string
          request_count: number
          window_started_at: string
        }
        Insert: {
          ip_hash: string
          last_seen_at?: string
          request_count?: number
          window_started_at?: string
        }
        Update: {
          ip_hash?: string
          last_seen_at?: string
          request_count?: number
          window_started_at?: string
        }
        Relationships: []
      }
      public_form_steps: {
        Row: {
          created_at: string | null
          description: string | null
          field_key: string | null
          form_id: string
          id: string
          is_required: boolean
          options: Json
          placeholder: string | null
          position: number
          step_type: string
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          field_key?: string | null
          form_id: string
          id?: string
          is_required?: boolean
          options?: Json
          placeholder?: string | null
          position?: number
          step_type: string
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          field_key?: string | null
          form_id?: string
          id?: string
          is_required?: boolean
          options?: Json
          placeholder?: string | null
          position?: number
          step_type?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "public_form_steps_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "public_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      public_form_submissions: {
        Row: {
          answers: Json
          contact_email: string | null
          contact_name: string
          contact_phone: string
          created_at: string | null
          form_id: string
          geo_accuracy_m: number | null
          geo_permission: string
          id: string
          latitude: number | null
          lead_id: string | null
          longitude: number | null
          user_agent: string | null
        }
        Insert: {
          answers?: Json
          contact_email?: string | null
          contact_name: string
          contact_phone: string
          created_at?: string | null
          form_id: string
          geo_accuracy_m?: number | null
          geo_permission?: string
          id?: string
          latitude?: number | null
          lead_id?: string | null
          longitude?: number | null
          user_agent?: string | null
        }
        Update: {
          answers?: Json
          contact_email?: string | null
          contact_name?: string
          contact_phone?: string
          created_at?: string | null
          form_id?: string
          geo_accuracy_m?: number | null
          geo_permission?: string
          id?: string
          latitude?: number | null
          lead_id?: string | null
          longitude?: number | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "public_form_submissions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "public_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_form_submissions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      public_forms: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_published: boolean
          request_geolocation: boolean
          slug: string
          submission_count: number
          success_headline: string
          success_message: string
          title: string
          updated_at: string | null
          whatsapp_message_template: string | null
          whatsapp_redirect: boolean
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_published?: boolean
          request_geolocation?: boolean
          slug: string
          submission_count?: number
          success_headline?: string
          success_message?: string
          title: string
          updated_at?: string | null
          whatsapp_message_template?: string | null
          whatsapp_redirect?: boolean
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_published?: boolean
          request_geolocation?: boolean
          slug?: string
          submission_count?: number
          success_headline?: string
          success_message?: string
          title?: string
          updated_at?: string | null
          whatsapp_message_template?: string | null
          whatsapp_redirect?: boolean
        }
        Relationships: []
      }
      public_lead_rate_limits: {
        Row: {
          ip_hash: string
          last_seen_at: string
          request_count: number
          window_started_at: string
        }
        Insert: {
          ip_hash: string
          last_seen_at?: string
          request_count?: number
          window_started_at?: string
        }
        Update: {
          ip_hash?: string
          last_seen_at?: string
          request_count?: number
          window_started_at?: string
        }
        Relationships: []
      }
      public_link_items: {
        Row: {
          click_count: number
          created_at: string | null
          icon: string
          id: string
          is_active: boolean
          position: number
          title: string
          updated_at: string | null
          url: string
        }
        Insert: {
          click_count?: number
          created_at?: string | null
          icon?: string
          id?: string
          is_active?: boolean
          position?: number
          title: string
          updated_at?: string | null
          url: string
        }
        Update: {
          click_count?: number
          created_at?: string | null
          icon?: string
          id?: string
          is_active?: boolean
          position?: number
          title?: string
          updated_at?: string | null
          url?: string
        }
        Relationships: []
      }
      public_link_page_settings: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          id: string
          is_published: boolean
          is_verified: boolean
          subtitle: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          id?: string
          is_published?: boolean
          is_verified?: boolean
          subtitle?: string | null
          title?: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          id?: string
          is_published?: boolean
          is_verified?: boolean
          subtitle?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      reminders: {
        Row: {
          anexos: Json | null
          ano: number | null
          concluido_em: string | null
          contract_id: string | null
          created_at: string | null
          data_lembrete: string
          descricao: string | null
          follow_up_approved_at: string | null
          follow_up_approved_by: string | null
          follow_up_batch_id: string | null
          follow_up_generation_id: string | null
          follow_up_origin: string | null
          follow_up_suggested_at: string | null
          id: string
          lead_id: string | null
          lido: boolean | null
          pessoa_chave: string | null
          pessoa_id: string | null
          pessoa_tipo: string | null
          prioridade: string | null
          push_notified_at: string | null
          recorrencia: string | null
          recorrencia_config: Json | null
          snooze_count: number | null
          tags: string[] | null
          tempo_estimado_minutos: number | null
          tipo: string
          titulo: string
          ultima_modificacao: string | null
          whatsapp_schedule_id: string | null
        }
        Insert: {
          anexos?: Json | null
          ano?: number | null
          concluido_em?: string | null
          contract_id?: string | null
          created_at?: string | null
          data_lembrete: string
          descricao?: string | null
          follow_up_approved_at?: string | null
          follow_up_approved_by?: string | null
          follow_up_batch_id?: string | null
          follow_up_generation_id?: string | null
          follow_up_origin?: string | null
          follow_up_suggested_at?: string | null
          id?: string
          lead_id?: string | null
          lido?: boolean | null
          pessoa_chave?: string | null
          pessoa_id?: string | null
          pessoa_tipo?: string | null
          prioridade?: string | null
          push_notified_at?: string | null
          recorrencia?: string | null
          recorrencia_config?: Json | null
          snooze_count?: number | null
          tags?: string[] | null
          tempo_estimado_minutos?: number | null
          tipo: string
          titulo: string
          ultima_modificacao?: string | null
          whatsapp_schedule_id?: string | null
        }
        Update: {
          anexos?: Json | null
          ano?: number | null
          concluido_em?: string | null
          contract_id?: string | null
          created_at?: string | null
          data_lembrete?: string
          descricao?: string | null
          follow_up_approved_at?: string | null
          follow_up_approved_by?: string | null
          follow_up_batch_id?: string | null
          follow_up_generation_id?: string | null
          follow_up_origin?: string | null
          follow_up_suggested_at?: string | null
          id?: string
          lead_id?: string | null
          lido?: boolean | null
          pessoa_chave?: string | null
          pessoa_id?: string | null
          pessoa_tipo?: string | null
          prioridade?: string | null
          push_notified_at?: string | null
          recorrencia?: string | null
          recorrencia_config?: Json | null
          snooze_count?: number | null
          tags?: string[] | null
          tempo_estimado_minutos?: number | null
          tipo?: string
          titulo?: string
          ultima_modificacao?: string | null
          whatsapp_schedule_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reminders_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_follow_up_approved_by_fkey"
            columns: ["follow_up_approved_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_follow_up_generation_id_fkey"
            columns: ["follow_up_generation_id"]
            isOneToOne: false
            referencedRelation: "comm_follow_up_audit_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      system_configurations: {
        Row: {
          category: string
          config_key: string
          config_value: Json
          created_at: string
          description: string | null
          id: string
          label: number | null
          ordem: number | null
          updated_at: string
        }
        Insert: {
          category: string
          config_key: string
          config_value: Json
          created_at?: string
          description?: string | null
          id?: string
          label?: number | null
          ordem?: number | null
          updated_at?: string
        }
        Update: {
          category?: string
          config_key?: string
          config_value?: Json
          created_at?: string
          description?: string | null
          id?: string
          label?: number | null
          ordem?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          company_name: string | null
          created_at: string | null
          date_format: string | null
          id: string
          notification_interval_seconds: number | null
          notification_sound_enabled: boolean | null
          notification_volume: number | null
          session_timeout_minutes: number | null
          timezone: string
          updated_at: string | null
        }
        Insert: {
          company_name?: string | null
          created_at?: string | null
          date_format?: string | null
          id?: string
          notification_interval_seconds?: number | null
          notification_sound_enabled?: boolean | null
          notification_volume?: number | null
          session_timeout_minutes?: number | null
          timezone?: string
          updated_at?: string | null
        }
        Update: {
          company_name?: string | null
          created_at?: string | null
          date_format?: string | null
          id?: string
          notification_interval_seconds?: number | null
          notification_sound_enabled?: boolean | null
          notification_volume?: number | null
          session_timeout_minutes?: number | null
          timezone?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string | null
          created_by: string | null
          email: string
          id: string
          role: string
          username: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          email: string
          id: string
          role?: string
          username: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          email?: string
          id?: string
          role?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_role_fkey"
            columns: ["role"]
            isOneToOne: false
            referencedRelation: "access_profiles"
            referencedColumns: ["slug"]
          },
        ]
      }
    }
    Views: {
      v_cron_job_runs: {
        Row: {
          command: string | null
          database: string | null
          end_time: string | null
          job_pid: number | null
          jobname: string | null
          return_message: string | null
          runid: number | null
          start_time: string | null
          status: string | null
          username: string | null
        }
        Relationships: []
      }
      v_cron_jobs: {
        Row: {
          active: boolean | null
          command: string | null
          database: string | null
          jobid: number | null
          jobname: string | null
          schedule: string | null
        }
        Insert: {
          active?: boolean | null
          command?: string | null
          database?: string | null
          jobid?: number | null
          jobname?: string | null
          schedule?: string | null
        }
        Update: {
          active?: boolean | null
          command?: string | null
          database?: string | null
          jobid?: number | null
          jobname?: string | null
          schedule?: string | null
        }
        Relationships: []
      }
      v_lead_processing_dashboard: {
        Row: {
          batch_size: number | null
          is_running: boolean | null
          last_activity: string | null
          last_error: string | null
          last_processed_at: string | null
          last_processed_phone: string | null
          pending_count: number | null
          processed_last_24h: number | null
          processed_last_hour: number | null
          reset_count: number | null
          system_status: string | null
          total_processed: number | null
        }
        Insert: {
          batch_size?: number | null
          is_running?: boolean | null
          last_activity?: string | null
          last_error?: string | null
          last_processed_at?: string | null
          last_processed_phone?: string | null
          pending_count?: never
          processed_last_24h?: never
          processed_last_hour?: never
          reset_count?: number | null
          system_status?: never
          total_processed?: number | null
        }
        Update: {
          batch_size?: number | null
          is_running?: boolean | null
          last_activity?: string | null
          last_error?: string | null
          last_processed_at?: string | null
          last_processed_phone?: string | null
          pending_count?: never
          processed_last_24h?: never
          processed_last_hour?: never
          reset_count?: number | null
          system_status?: never
          total_processed?: number | null
        }
        Relationships: []
      }
      v_pending_leads_summary: {
        Row: {
          has_attempts: number | null
          max_attempts_reached: number | null
          pending_auto_message: number | null
          status: string | null
          total: number | null
        }
        Relationships: []
      }
      v_system_status: {
        Row: {
          batch_size: number | null
          cron_active: boolean | null
          cycle_count: number | null
          last_error: string | null
          last_run: string | null
          pending_leads: number | null
          processor_running: boolean | null
          status_message: string | null
          total_processed: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      advance_step_dispatch: {
        Args: {
          p_delivery_status?: string
          p_dispatch_key: string
          p_error_message?: string
          p_external_message_id?: string
          p_new_status: string
          p_next_retry_at?: string
          p_resolution?: string
        }
        Returns: {
          dispatch_id: string
          new_status: string
          old_status: string
        }[]
      }
      archive_comm_whatsapp_old_deleted_chat_messages: {
        Args: { p_batch_size?: number; p_older_than_days?: number }
        Returns: number
      }
      audit_apply_reativacao: { Args: never; Returns: undefined }
      audit_classify_single_lead: {
        Args: {
          p_lead_id: string
          p_perdido_id: string
          p_reativacao_id: string
        }
        Returns: {
          chat_resolution_method: string
          classification: string
          confidence: number
          do_not_reactivate: boolean
          evidence_snippet: string
          furthest_stage: string
          has_conversation: boolean
          last_inbound_at: string
          last_message_direction: string
          last_outbound_at: string
          message_count: number
          reason_code: string
          reason_text: string
        }[]
      }
      audit_exec_sql: { Args: { p_sql: string }; Returns: undefined }
      audit_generate_report: {
        Args: never
        Returns: {
          chat_resolution_method: string
          classification: string
          confidence: number
          current_status: string
          do_not_reactivate: boolean
          evidence_snippet: string
          furthest_stage: string
          has_conversation: boolean
          last_inbound_at: string
          last_message_direction: string
          last_outbound_at: string
          lead_id: string
          lead_nome: string
          lead_telefone: string
          message_count: number
          reason_code: string
          reason_text: string
        }[]
      }
      audit_get_func_def: { Args: { p_name: string }; Returns: string }
      audit_get_func_source: { Args: { p_name: string }; Returns: string }
      audit_get_source: {
        Args: { p_name: string }
        Returns: {
          line: string
        }[]
      }
      audit_get_summary: {
        Args: { p_run_id: string }
        Returns: {
          classification: string
          count: number
          pct: number
          reason_code: string
        }[]
      }
      audit_normalize_text: { Args: { p_text: string }; Returns: string }
      audit_run_dry_run: {
        Args: { p_batch_size?: number; p_run_id: string }
        Returns: undefined
      }
      automation_flows_health: { Args: never; Returns: Json }
      build_dependent_pessoa_chave: {
        Args: { birth_value: string; cpf_value: string; name_value: string }
        Returns: string
      }
      build_holder_pessoa_chave: {
        Args: { cpf_value: string }
        Returns: string
      }
      cancel_future_pending_dispatches: {
        Args: { p_after_step_index: number; p_target_id: string }
        Returns: number
      }
      canonicalize_cotador_hospital_network_entries: {
        Args: { entries: Json }
        Returns: Json
      }
      check_auto_contact_inactivity_triggers: {
        Args: never
        Returns: undefined
      }
      check_lead_created_backlog_triggers: { Args: never; Returns: undefined }
      check_status_duration_triggers: { Args: never; Returns: undefined }
      claim_comm_whatsapp_campaign_targets: {
        Args: {
          p_campaign_id: string
          p_limit?: number
          p_lock_token?: string
          p_lock_ttl?: string
        }
        Returns: {
          ab_variant: string | null
          attempts: number
          campaign_id: string
          chat_id: string | null
          created_at: string
          current_step_index: number
          display_name: string | null
          error_message: string | null
          external_message_id: string | null
          id: string
          last_attempt_at: string | null
          lead_id: string | null
          lock_token: string | null
          locked_at: string | null
          next_retry_at: string | null
          next_send_at: string | null
          phone_digits: string
          phone_number: string
          responded_at: string | null
          retry_count: number
          sent_at: string | null
          source_kind: string
          source_payload: Json
          status: string
          stopped_at: string | null
          stopped_reason: string | null
          updated_at: string
          whatsapp_check_status: string
          whatsapp_checked_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "comm_whatsapp_campaign_targets"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_comm_whatsapp_enrichment_jobs: {
        Args: { p_limit?: number; p_lock_token?: string; p_lock_ttl?: string }
        Returns: {
          attempts: number
          channel_id: string
          chat_id: string | null
          completed_at: string | null
          created_at: string
          dedupe_key: string
          id: string
          kind: string
          last_error: string | null
          lock_token: string | null
          locked_at: string | null
          message_id: string | null
          next_attempt_at: string
          payload: Json
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "comm_whatsapp_enrichment_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cleanup_comm_whatsapp_event_receipts: {
        Args: { p_batch_limit?: number; p_retention?: string }
        Returns: number
      }
      cleanup_comm_whatsapp_webhook_archive: {
        Args: { p_retention?: string }
        Returns: {
          archive_path: string
        }[]
      }
      cleanup_logs_7d: { Args: never; Returns: undefined }
      comm_whatsapp_apply_message_mutation: {
        Args: {
          p_channel_id: string
          p_dedupe_key?: string
          p_event_external_message_id?: string
          p_mutation_type: string
          p_occurred_at?: string
          p_payload?: Json
          p_target_external_message_id: string
        }
        Returns: {
          applied: boolean
          chat_id: string
          queued: boolean
        }[]
      }
      comm_whatsapp_clear_invalid_lid_phone: {
        Args: { p_chat_id: string; p_fallback_name?: string }
        Returns: boolean
      }
      comm_whatsapp_delete_chat: {
        Args: { p_chat_id: string }
        Returns: {
          archived_at: string | null
          auto_link_blocked: boolean
          autonomous_attendance_status: string
          channel_id: string
          created_at: string
          deleted_at: string | null
          display_name: string
          external_chat_id: string
          id: string
          identity_conflict: boolean
          is_archived: boolean
          is_muted: boolean
          is_pinned: boolean
          last_message_at: string | null
          last_message_delivery_status: string | null
          last_message_direction: string
          last_message_status_updated_at: string | null
          last_message_text: string | null
          last_read_at: string | null
          lead_id: string | null
          lead_link_source: string | null
          lead_linked_at: string | null
          lead_linked_by: string | null
          manual_unread: boolean
          manual_unread_at: string | null
          merged_into_chat_id: string | null
          muted_at: string | null
          phone_digits: string
          phone_number: string
          pinned_at: string | null
          push_name: string | null
          saved_contact_name: string | null
          status: string
          unread_count: number
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "comm_whatsapp_chats"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      comm_whatsapp_diagnose_chat_message_mismatch: {
        Args: never
        Returns: {
          chat_id: string
          display_name: string
          external_chat_id: string
          issue: string
          last_message_at: string
          message_count: number
        }[]
      }
      comm_whatsapp_ensure_observed_chat: {
        Args: {
          p_channel_id: string
          p_external_chat_id: string
          p_phone_number?: string
          p_push_name?: string
        }
        Returns: {
          archived_at: string | null
          auto_link_blocked: boolean
          autonomous_attendance_status: string
          channel_id: string
          created_at: string
          deleted_at: string | null
          display_name: string
          external_chat_id: string
          id: string
          identity_conflict: boolean
          is_archived: boolean
          is_muted: boolean
          is_pinned: boolean
          last_message_at: string | null
          last_message_delivery_status: string | null
          last_message_direction: string
          last_message_status_updated_at: string | null
          last_message_text: string | null
          last_read_at: string | null
          lead_id: string | null
          lead_link_source: string | null
          lead_linked_at: string | null
          lead_linked_by: string | null
          manual_unread: boolean
          manual_unread_at: string | null
          merged_into_chat_id: string | null
          muted_at: string | null
          phone_digits: string
          phone_number: string
          pinned_at: string | null
          push_name: string | null
          saved_contact_name: string | null
          status: string
          unread_count: number
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "comm_whatsapp_chats"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      comm_whatsapp_extract_business_display_name: {
        Args: { p_text: string }
        Returns: string
      }
      comm_whatsapp_format_phone_label: {
        Args: { p_phone: string }
        Returns: string
      }
      comm_whatsapp_get_canonical_chat_route: {
        Args: {
          p_channel_id?: string
          p_chat_id?: string
          p_external_chat_id?: string
        }
        Returns: {
          channel_id: string
          chat_id: string
          deleted_at: string
          display_name: string
          external_chat_id: string
          identity_conflict: boolean
          lead_id: string
          phone_number: string
          push_name: string
        }[]
      }
      comm_whatsapp_get_channel_state: {
        Args: never
        Returns: {
          connected_user_name: string
          connection_status: string
          created_at: string
          enabled: boolean
          health_snapshot: Json
          health_status: string
          id: string
          last_error: string
          last_health_check_at: string
          last_webhook_received_at: string
          limits_snapshot: Json
          name: string
          phone_number: string
          slug: string
          updated_at: string
          whapi_channel_id: string
        }[]
      }
      comm_whatsapp_get_chat_lead_panel: {
        Args: { p_chat_id: string }
        Returns: {
          favorito: boolean
          id: string
          nome_completo: string
          observacoes: string
          responsavel_label: string
          responsavel_value: string
          status_nome: string
          status_value: string
          telefone: string
        }[]
      }
      comm_whatsapp_get_chat_thread: {
        Args: { p_chat_id: string; p_limit?: number }
        Returns: Json
      }
      comm_whatsapp_get_dashboard_metrics: { Args: never; Returns: Json }
      comm_whatsapp_get_operational_state: {
        Args: never
        Returns: {
          config_enabled: boolean
          connected_user_name: string
          connection_status: string
          created_at: string
          enabled: boolean
          health_snapshot: Json
          health_status: string
          id: string
          last_error: string
          last_health_check_at: string
          last_webhook_received_at: string
          limits_snapshot: Json
          name: string
          phone_number: string
          slug: string
          token_configured: boolean
          updated_at: string
          whapi_channel_id: string
        }[]
      }
      comm_whatsapp_guess_business_display_name: {
        Args: { p_chat_id: string }
        Returns: string
      }
      comm_whatsapp_is_hidden_preview_text: {
        Args: { p_message_type?: string; p_value: string }
        Returns: boolean
      }
      comm_whatsapp_is_valid_display_name: {
        Args: { p_value: string }
        Returns: boolean
      }
      comm_whatsapp_link_chat_lead: {
        Args: { p_chat_id: string; p_lead_id: string }
        Returns: {
          archived_at: string | null
          auto_link_blocked: boolean
          autonomous_attendance_status: string
          channel_id: string
          created_at: string
          deleted_at: string | null
          display_name: string
          external_chat_id: string
          id: string
          identity_conflict: boolean
          is_archived: boolean
          is_muted: boolean
          is_pinned: boolean
          last_message_at: string | null
          last_message_delivery_status: string | null
          last_message_direction: string
          last_message_status_updated_at: string | null
          last_message_text: string | null
          last_read_at: string | null
          lead_id: string | null
          lead_link_source: string | null
          lead_linked_at: string | null
          lead_linked_by: string | null
          manual_unread: boolean
          manual_unread_at: string | null
          merged_into_chat_id: string | null
          muted_at: string | null
          phone_digits: string
          phone_number: string
          pinned_at: string | null
          push_name: string | null
          saved_contact_name: string | null
          status: string
          unread_count: number
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "comm_whatsapp_chats"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      comm_whatsapp_list_chat_media_page: {
        Args: {
          p_before_id?: string
          p_before_message_at?: string
          p_chat_id: string
          p_limit?: number
          p_media_type?: string
        }
        Returns: {
          channel_id: string
          chat_id: string
          created_at: string
          created_by: string | null
          delivery_status: string
          direction: string
          error_message: string | null
          external_message_id: string | null
          id: string
          media_caption: string | null
          media_duration_seconds: number | null
          media_file_name: string | null
          media_id: string | null
          media_mime_type: string | null
          media_size_bytes: number | null
          media_url: string | null
          message_at: string
          message_type: string
          metadata: Json
          sender_name: string | null
          sender_phone: string | null
          source: string | null
          status_updated_at: string | null
          text_content: string | null
          transcription_error: string | null
          transcription_model: string | null
          transcription_provider: string | null
          transcription_requested_by: string | null
          transcription_status: string
          transcription_text: string | null
          transcription_updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "comm_whatsapp_messages"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      comm_whatsapp_list_chats: {
        Args: {
          p_activity_filter?: string
          p_archived_filter?: string
          p_lead_filter?: string
          p_lead_responsavel_filters?: string[]
          p_lead_status_filters?: string[]
          p_limit?: number
          p_offset?: number
          p_saved_filter?: string
          p_search?: string
        }
        Returns: {
          archived_at: string
          auto_link_blocked: boolean
          autonomous_attendance_status: string
          channel_id: string
          created_at: string
          display_name: string
          external_chat_id: string
          id: string
          identity_conflict: boolean
          is_archived: boolean
          is_muted: boolean
          is_pinned: boolean
          last_message_at: string
          last_message_delivery_status: string
          last_message_direction: string
          last_message_text: string
          last_read_at: string
          lead_id: string
          lead_link_source: string
          lead_linked_at: string
          lead_linked_by: string
          lead_name: string
          lead_responsavel: string
          lead_responsavel_id: string
          lead_status: string
          manual_unread: boolean
          manual_unread_at: string
          merged_into_chat_id: string
          muted_at: string
          phone_digits: string
          phone_number: string
          pinned_at: string
          push_name: string
          saved_contact_name: string
          status: string
          unread_count: number
          updated_at: string
        }[]
      }
      comm_whatsapp_list_lead_contracts: {
        Args: { p_lead_id: string }
        Returns: {
          codigo_contrato: string
          id: string
          mensalidade_total: number
          modalidade: string
          operadora: string
          produto_plano: string
          status: string
        }[]
      }
      comm_whatsapp_list_message_context: {
        Args: {
          p_after_limit?: number
          p_before_limit?: number
          p_chat_id: string
          p_message_id: string
        }
        Returns: {
          channel_id: string
          chat_id: string
          created_at: string
          created_by: string | null
          delivery_status: string
          direction: string
          error_message: string | null
          external_message_id: string | null
          id: string
          media_caption: string | null
          media_duration_seconds: number | null
          media_file_name: string | null
          media_id: string | null
          media_mime_type: string | null
          media_size_bytes: number | null
          media_url: string | null
          message_at: string
          message_type: string
          metadata: Json
          sender_name: string | null
          sender_phone: string | null
          source: string | null
          status_updated_at: string | null
          text_content: string | null
          transcription_error: string | null
          transcription_model: string | null
          transcription_provider: string | null
          transcription_requested_by: string | null
          transcription_status: string
          transcription_text: string | null
          transcription_updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "comm_whatsapp_messages"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      comm_whatsapp_list_messages_page: {
        Args: {
          p_before_id?: string
          p_before_message_at?: string
          p_chat_id: string
          p_limit?: number
        }
        Returns: {
          channel_id: string
          chat_id: string
          created_at: string
          created_by: string | null
          delivery_status: string
          direction: string
          error_message: string | null
          external_message_id: string | null
          id: string
          media_caption: string | null
          media_duration_seconds: number | null
          media_file_name: string | null
          media_id: string | null
          media_mime_type: string | null
          media_size_bytes: number | null
          media_url: string | null
          message_at: string
          message_type: string
          metadata: Json
          sender_name: string | null
          sender_phone: string | null
          source: string | null
          status_updated_at: string | null
          text_content: string | null
          transcription_error: string | null
          transcription_model: string | null
          transcription_provider: string | null
          transcription_requested_by: string | null
          transcription_status: string
          transcription_text: string | null
          transcription_updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "comm_whatsapp_messages"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      comm_whatsapp_lock_canonical_chat_uuid: {
        Args: { p_chat_id: string }
        Returns: string
      }
      comm_whatsapp_mark_chat_read:
        | {
            Args: { p_chat_id: string }
            Returns: {
              id: string
              last_read_at: string
              unread_count: number
            }[]
          }
        | {
            Args: {
              p_chat_id: string
              p_last_seen_message_at: string
              p_last_seen_message_id: string
            }
            Returns: {
              id: string
              last_read_at: string
              unread_count: number
            }[]
          }
      comm_whatsapp_message_preview_text: {
        Args: {
          p_media_caption: string
          p_message_type: string
          p_text_content: string
        }
        Returns: string
      }
      comm_whatsapp_open_or_create_chat: {
        Args: {
          p_external_chat_id: string
          p_lead_id?: string
          p_phone_number: string
          p_push_name?: string
          p_saved_contact_name?: string
        }
        Returns: {
          archived_at: string | null
          auto_link_blocked: boolean
          autonomous_attendance_status: string
          channel_id: string
          created_at: string
          deleted_at: string | null
          display_name: string
          external_chat_id: string
          id: string
          identity_conflict: boolean
          is_archived: boolean
          is_muted: boolean
          is_pinned: boolean
          last_message_at: string | null
          last_message_delivery_status: string | null
          last_message_direction: string
          last_message_status_updated_at: string | null
          last_message_text: string | null
          last_read_at: string | null
          lead_id: string | null
          lead_link_source: string | null
          lead_linked_at: string | null
          lead_linked_by: string | null
          manual_unread: boolean
          manual_unread_at: string | null
          merged_into_chat_id: string | null
          muted_at: string | null
          phone_digits: string
          phone_number: string
          pinned_at: string | null
          push_name: string | null
          saved_contact_name: string | null
          status: string
          unread_count: number
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "comm_whatsapp_chats"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      comm_whatsapp_pending_follow_up_chats: {
        Args: never
        Returns: {
          chat_id: string
          external_chat_id: string
          last_message_at: string
          last_message_text: string
          lead_favorito: boolean
          lead_id: string
          lead_name: string
          lead_phone: string
          reminder_due_at: string
          reminder_id: string
          reminder_priority: string
          reminder_title: string
        }[]
      }
      comm_whatsapp_persist_message:
        | {
            Args: {
              p_channel_id: string
              p_created_by: string
              p_delivery_status: string
              p_direction: string
              p_display_name: string
              p_error_message: string
              p_external_chat_id: string
              p_external_message_id: string
              p_increment_unread: boolean
              p_last_message_at: string
              p_last_message_direction: string
              p_last_message_text: string
              p_message_type: string
              p_metadata?: Json
              p_phone_number: string
              p_push_name: string
              p_sender_name: string
              p_sender_phone: string
              p_source: string
              p_status_updated_at: string
              p_text_content: string
            }
            Returns: {
              chat_id: string
              inserted: boolean
              message_id: string
              summary_updated: boolean
              unread_count: number
            }[]
          }
        | {
            Args: {
              p_channel_id: string
              p_created_by: string
              p_delivery_status: string
              p_direction: string
              p_display_name: string
              p_error_message: string
              p_external_chat_id: string
              p_external_message_id: string
              p_increment_unread: boolean
              p_last_message_at: string
              p_last_message_direction: string
              p_last_message_text: string
              p_media_caption?: string
              p_media_duration_seconds?: number
              p_media_file_name?: string
              p_media_id?: string
              p_media_mime_type?: string
              p_media_size_bytes?: number
              p_media_url?: string
              p_message_type: string
              p_metadata?: Json
              p_phone_number: string
              p_push_name: string
              p_sender_name: string
              p_sender_phone: string
              p_source: string
              p_status_updated_at: string
              p_text_content: string
            }
            Returns: {
              chat_id: string
              inserted: boolean
              message_id: string
              summary_updated: boolean
              unread_count: number
            }[]
          }
      comm_whatsapp_persist_message_internal: {
        Args: {
          p_channel_id: string
          p_created_by: string
          p_delivery_status: string
          p_direction: string
          p_display_name: string
          p_error_message: string
          p_external_chat_id: string
          p_external_message_id: string
          p_increment_unread: boolean
          p_last_message_at: string
          p_last_message_direction: string
          p_last_message_text: string
          p_media_caption?: string
          p_media_duration_seconds?: number
          p_media_file_name?: string
          p_media_id?: string
          p_media_mime_type?: string
          p_media_size_bytes?: number
          p_media_url?: string
          p_message_type: string
          p_metadata?: Json
          p_phone_number: string
          p_push_name: string
          p_sender_name: string
          p_sender_phone: string
          p_source: string
          p_status_updated_at: string
          p_text_content: string
        }
        Returns: {
          chat_id: string
          inserted: boolean
          message_id: string
          summary_updated: boolean
          unread_count: number
        }[]
      }
      comm_whatsapp_phone_lookup_keys: {
        Args: { p_phone: string }
        Returns: string[]
      }
      comm_whatsapp_reconcile_lid_identifier:
        | {
            Args: {
              p_channel_id: string
              p_lid_external_chat_id: string
              p_phone_external_chat_id: string
            }
            Returns: {
              chat_id: string
              conflict_reason: string
              external_chat_id: string
              merged: boolean
            }[]
          }
        | {
            Args: {
              p_channel_id: string
              p_lid_external_chat_id: string
              p_mapping_evidence: Json
              p_phone_external_chat_id: string
            }
            Returns: {
              chat_id: string
              conflict_reason: string
              external_chat_id: string
              merged: boolean
            }[]
          }
      comm_whatsapp_refresh_channel_chat_identities: {
        Args: { p_channel_id: string }
        Returns: number
      }
      comm_whatsapp_refresh_chat_identity: {
        Args: { p_chat_id: string }
        Returns: {
          archived_at: string | null
          auto_link_blocked: boolean
          autonomous_attendance_status: string
          channel_id: string
          created_at: string
          deleted_at: string | null
          display_name: string
          external_chat_id: string
          id: string
          identity_conflict: boolean
          is_archived: boolean
          is_muted: boolean
          is_pinned: boolean
          last_message_at: string | null
          last_message_delivery_status: string | null
          last_message_direction: string
          last_message_status_updated_at: string | null
          last_message_text: string | null
          last_read_at: string | null
          lead_id: string | null
          lead_link_source: string | null
          lead_linked_at: string | null
          lead_linked_by: string | null
          manual_unread: boolean
          manual_unread_at: string | null
          merged_into_chat_id: string | null
          muted_at: string | null
          phone_digits: string
          phone_number: string
          pinned_at: string | null
          push_name: string | null
          saved_contact_name: string | null
          status: string
          unread_count: number
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "comm_whatsapp_chats"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      comm_whatsapp_register_chat_identifier: {
        Args: {
          p_channel_id: string
          p_chat_id: string
          p_evidence?: Json
          p_external_chat_id: string
          p_source?: string
          p_verified?: boolean
        }
        Returns: string
      }
      comm_whatsapp_report_storage_growth: { Args: never; Returns: Json }
      comm_whatsapp_resolve_canonical_chat_id: {
        Args: { p_channel_id: string; p_external_chat_id: string }
        Returns: string
      }
      comm_whatsapp_resolve_canonical_chat_uuid: {
        Args: { p_channel_id: string; p_external_chat_id: string }
        Returns: string
      }
      comm_whatsapp_resolve_chat_uuid: {
        Args: { p_chat_id: string }
        Returns: string
      }
      comm_whatsapp_search_cotador_quotes_by_topic: {
        Args: { p_limit?: number; p_search: string; p_terms?: string[] }
        Returns: {
          items: Json
          latest_item_at: string
          lead: Json
          match_count: number
          quote: Json
        }[]
      }
      comm_whatsapp_search_crm_leads: {
        Args: { p_limit?: number; p_phone_numbers?: string[]; p_query?: string }
        Returns: {
          favorito: boolean
          id: string
          nome_completo: string
          responsavel_label: string
          responsavel_value: string
          status_nome: string
          status_value: string
          telefone: string
        }[]
      }
      comm_whatsapp_search_leads_by_conversation_topic: {
        Args: {
          p_direction?: string
          p_limit?: number
          p_optional_terms?: string[]
          p_required_terms?: string[]
          p_search: string
          p_since?: string
          p_terms?: string[]
        }
        Returns: {
          chat: Json
          latest_message_at: string
          lead: Json
          match_count: number
          snippets: Json
        }[]
      }
      comm_whatsapp_search_messages: {
        Args: {
          p_archived_filter?: string
          p_chat_ids?: string[]
          p_limit?: number
          p_search: string
        }
        Returns: {
          chat: Json
          message: Json
        }[]
      }
      comm_whatsapp_set_autonomous_attendance_status: {
        Args: { p_chat_id: string; p_status: string }
        Returns: {
          archived_at: string | null
          auto_link_blocked: boolean
          autonomous_attendance_status: string
          channel_id: string
          created_at: string
          deleted_at: string | null
          display_name: string
          external_chat_id: string
          id: string
          identity_conflict: boolean
          is_archived: boolean
          is_muted: boolean
          is_pinned: boolean
          last_message_at: string | null
          last_message_delivery_status: string | null
          last_message_direction: string
          last_message_status_updated_at: string | null
          last_message_text: string | null
          last_read_at: string | null
          lead_id: string | null
          lead_link_source: string | null
          lead_linked_at: string | null
          lead_linked_by: string | null
          manual_unread: boolean
          manual_unread_at: string | null
          merged_into_chat_id: string | null
          muted_at: string | null
          phone_digits: string
          phone_number: string
          pinned_at: string | null
          push_name: string | null
          saved_contact_name: string | null
          status: string
          unread_count: number
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "comm_whatsapp_chats"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      comm_whatsapp_set_chat_push_name: {
        Args: { p_chat_id: string; p_push_name: string }
        Returns: string
      }
      comm_whatsapp_should_apply_status: {
        Args: { p_current_status: string; p_next_status: string }
        Returns: boolean
      }
      comm_whatsapp_status_rank: { Args: { p_status: string }; Returns: number }
      comm_whatsapp_test_dollar: {
        Args: { p_channel_id: string; p_external_chat_id: string }
        Returns: string
      }
      comm_whatsapp_test_fn: { Args: { p_lid: string }; Returns: string }
      comm_whatsapp_test_resolve: {
        Args: { p_channel_id: string; p_external_chat_id: string }
        Returns: string
      }
      comm_whatsapp_try_auto_link_chat: {
        Args: { p_chat_id: string; p_phone_number: string; p_source?: string }
        Returns: boolean
      }
      comm_whatsapp_unlink_chat_lead: {
        Args: { p_chat_id: string }
        Returns: {
          archived_at: string | null
          auto_link_blocked: boolean
          autonomous_attendance_status: string
          channel_id: string
          created_at: string
          deleted_at: string | null
          display_name: string
          external_chat_id: string
          id: string
          identity_conflict: boolean
          is_archived: boolean
          is_muted: boolean
          is_pinned: boolean
          last_message_at: string | null
          last_message_delivery_status: string | null
          last_message_direction: string
          last_message_status_updated_at: string | null
          last_message_text: string | null
          last_read_at: string | null
          lead_id: string | null
          lead_link_source: string | null
          lead_linked_at: string | null
          lead_linked_by: string | null
          manual_unread: boolean
          manual_unread_at: string | null
          merged_into_chat_id: string | null
          muted_at: string | null
          phone_digits: string
          phone_number: string
          pinned_at: string | null
          push_name: string | null
          saved_contact_name: string | null
          status: string
          unread_count: number
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "comm_whatsapp_chats"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      comm_whatsapp_update_chat_inbox_state: {
        Args: {
          p_chat_id: string
          p_is_archived?: boolean
          p_is_muted?: boolean
          p_is_pinned?: boolean
          p_mark_as_unread?: boolean
        }
        Returns: {
          archived_at: string | null
          auto_link_blocked: boolean
          autonomous_attendance_status: string
          channel_id: string
          created_at: string
          deleted_at: string | null
          display_name: string
          external_chat_id: string
          id: string
          identity_conflict: boolean
          is_archived: boolean
          is_muted: boolean
          is_pinned: boolean
          last_message_at: string | null
          last_message_delivery_status: string | null
          last_message_direction: string
          last_message_status_updated_at: string | null
          last_message_text: string | null
          last_read_at: string | null
          lead_id: string | null
          lead_link_source: string | null
          lead_linked_at: string | null
          lead_linked_by: string | null
          manual_unread: boolean
          manual_unread_at: string | null
          merged_into_chat_id: string | null
          muted_at: string | null
          phone_digits: string
          phone_number: string
          pinned_at: string | null
          push_name: string | null
          saved_contact_name: string | null
          status: string
          unread_count: number
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "comm_whatsapp_chats"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      comm_whatsapp_update_linked_lead_responsavel: {
        Args: { p_chat_id: string; p_new_responsavel_value: string }
        Returns: {
          lead_id: string
          responsavel: string
          responsavel_id: string
        }[]
      }
      comm_whatsapp_update_linked_lead_status: {
        Args: { p_chat_id: string; p_new_status: string }
        Returns: {
          lead_id: string
          status: string
          ultimo_contato: string
        }[]
      }
      comm_whatsapp_update_message_status: {
        Args: {
          p_channel_id: string
          p_delivery_status: string
          p_error_message?: string
          p_external_message_id: string
          p_status_updated_at?: string
        }
        Returns: boolean
      }
      complete_ai_autonomous_attendance_handoff: {
        Args: { p_chat_id: string; p_handoff_code: string; p_lead_id: string }
        Returns: {
          chat_id: string
          lead_status_id: string
          status_applied: boolean
        }[]
      }
      compute_next_adjustment_date: {
        Args: {
          contract_start: string
          reajuste_month: number
          reference_date: string
        }
        Returns: string
      }
      consume_comm_whatsapp_action_rate_limit: {
        Args: {
          p_max_requests: number
          p_scope: string
          p_user_id: string
          p_window_seconds: number
        }
        Returns: boolean
      }
      consume_public_form_rate_limit: {
        Args: { p_ip_hash: string }
        Returns: boolean
      }
      consume_public_lead_rate_limit: {
        Args: { p_ip_hash: string }
        Returns: boolean
      }
      create_ai_feature_config: {
        Args: {
          p_config?: Json
          p_created_by?: string
          p_feature_key: string
          p_prompt: string
        }
        Returns: string
      }
      current_user_access_role: { Args: never; Returns: string }
      current_user_can_edit_any_module: {
        Args: { module_ids: string[] }
        Returns: boolean
      }
      current_user_can_edit_comm_whatsapp: { Args: never; Returns: boolean }
      current_user_can_edit_whatsapp: { Args: never; Returns: boolean }
      current_user_can_manage_access_profiles: { Args: never; Returns: boolean }
      current_user_can_manage_system_catalog: { Args: never; Returns: boolean }
      current_user_can_manage_users: { Args: never; Returns: boolean }
      current_user_can_view_any_module: {
        Args: { module_ids: string[] }
        Returns: boolean
      }
      current_user_can_view_comm_whatsapp: { Args: never; Returns: boolean }
      current_user_is_access_admin: { Args: never; Returns: boolean }
      debug_comm_auth: { Args: never; Returns: Json }
      dispatch_web_push_event: {
        Args: { event_name: string; payload: Json }
        Returns: undefined
      }
      format_cotador_hospital_label: {
        Args: { value: string }
        Returns: string
      }
      generate_adjustment_reminders_for_year: {
        Args: { target_year: number }
        Returns: undefined
      }
      generate_birthdays_for_year: {
        Args: { target_year: number }
        Returns: undefined
      }
      get_comm_whatsapp_campaign_failure_reasons: {
        Args: { p_campaign_id: string }
        Returns: {
          error_message: string
          total_count: number
        }[]
      }
      get_comm_whatsapp_campaign_target_status_counts: {
        Args: { p_campaign_id: string }
        Returns: {
          ab_variant: string
          responded_count: number
          status: string
          total_count: number
        }[]
      }
      get_commercial_state: {
        Args: { p_chat_id: string }
        Returns: {
          analysis_confidence: number | null
          blocker: string
          buying_signals: Json
          chat_id: string
          contact_role: string
          created_at: string
          decision_maker: string | null
          id: string
          known_facts: Json
          last_commercial_event: string | null
          last_commercial_function: string | null
          last_commitment: Json | null
          last_customer_position: string | null
          last_strategy_summary: string | null
          lead_id: string | null
          lead_temperature: string
          main_commercial_question: string | null
          next_action_owner: string
          objections: Json
          pending_microdecision: string | null
          previous_microdecision: string | null
          source_last_message_at: string | null
          source_last_message_id: string | null
          stage: string
          stakeholders: Json
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "comm_whatsapp_commercial_state"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_email_by_username: { Args: { p_username: string }; Returns: string }
      increment_public_link_click: {
        Args: { link_id: string }
        Returns: undefined
      }
      invoke_comm_whatsapp_campaign_worker: { Args: never; Returns: number }
      invoke_comm_whatsapp_enrichment_worker: { Args: never; Returns: number }
      invoke_process_pending_leads: { Args: never; Returns: number }
      is_leap_year: { Args: { year_value: number }; Returns: boolean }
      normalize_comm_whatsapp_chat_id: {
        Args: { value: string }
        Returns: string
      }
      normalize_comm_whatsapp_phone: {
        Args: { value: string }
        Returns: string
      }
      normalize_cpf: { Args: { value: string }; Returns: string }
      normalize_person_name: { Args: { value: string }; Returns: string }
      prepare_ai_autonomous_attendance_reply: {
        Args: { p_chat_id: string; p_lead_id: string }
        Returns: {
          can_reply: boolean
          moved_to_attendance: boolean
        }[]
      }
      release_pending_stage_dispatches: {
        Args: { p_lock_token: string; p_target_id: string }
        Returns: number
      }
      replace_cotador_produto_rede_hospitalar: {
        Args: { p_entries?: Json; p_produto_id: string }
        Returns: undefined
      }
      reserve_auto_contact_send_slot: {
        Args: { p_interval_seconds?: number }
        Returns: string
      }
      reserve_comm_whatsapp_campaign_dispatch: {
        Args: {
          p_campaign_id: string
          p_lock_token: string
          p_payload?: Json
          p_target_id: string
        }
        Returns: {
          attempts: number
          event_id: string
          reason: string
          reserved_at: string
          result: string
          retry_at: string
        }[]
      }
      reserve_comm_whatsapp_campaign_stage_dispatch: {
        Args: {
          p_campaign_id: string
          p_expected_message_count: number
          p_lock_token: string
          p_stage_index: number
          p_steps: Json
          p_target_id: string
        }
        Returns: {
          reason: string
          result: string
          retry_at: string
        }[]
      }
      reserve_comm_whatsapp_campaign_stage_dispatch_retry: {
        Args: {
          p_campaign_id: string
          p_lock_token: string
          p_stage_index: number
          p_steps: Json
          p_target_id: string
        }
        Returns: {
          reason: string
          result: string
          retry_at: string
        }[]
      }
      resolve_comm_whatsapp_campaign_stop_on_reply:
        | {
            Args: { p_chat_id: string; p_message_at: string }
            Returns: {
              campaign_id: string
              target_id: string
            }[]
          }
        | {
            Args: { p_external_chat_id: string; p_message_at: string }
            Returns: {
              campaign_id: string
              target_id: string
            }[]
          }
      resolve_cotador_hospital_region: {
        Args: { value: string }
        Returns: string
      }
      safe_make_date: {
        Args: { day_value: number; month_value: number; year_value: number }
        Returns: string
      }
      sanitize_cotador_hospital_bairro: {
        Args: {
          p_bairro: string
          p_cidade: string
          p_nome: string
          p_regiao: string
        }
        Returns: string
      }
      schedule_ai_autonomous_reply_job: {
        Args: { p_chat_id: string; p_delay_seconds?: number }
        Returns: undefined
      }
      schedule_follow_up_reminder: {
        Args: {
          p_description: string
          p_due_at: string
          p_lead_id: string
          p_priority?: string
          p_title: string
        }
        Returns: {
          inserted: boolean
          proximo_retorno: string
          reminder_id: string
        }[]
      }
      schedule_follow_up_reminder_v2: {
        Args: {
          p_approved_by?: string
          p_batch_id?: string
          p_description: string
          p_due_at: string
          p_generation_id?: string
          p_lead_id: string
          p_origin?: string
          p_priority?: string
          p_suggested_at?: string
          p_title: string
        }
        Returns: {
          inserted: boolean
          proximo_retorno: string
          reminder_id: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      trigger_lead_processing_now: { Args: never; Returns: Json }
      upsert_commercial_state: {
        Args: {
          p_analysis_confidence: number
          p_blocker: string
          p_buying_signals: Json
          p_chat_id: string
          p_contact_role: string
          p_decision_maker: string
          p_known_facts: Json
          p_last_commercial_event: string
          p_last_commercial_function: string
          p_last_commitment: Json
          p_last_customer_position: string
          p_last_strategy_summary: string
          p_lead_id: string
          p_lead_temperature: string
          p_main_commercial_question: string
          p_next_action_owner: string
          p_objections: Json
          p_pending_microdecision: string
          p_previous_microdecision: string
          p_source_last_message_at: string
          p_source_last_message_id: string
          p_stage: string
          p_stakeholders: Json
        }
        Returns: string
      }
      user_is_admin: { Args: never; Returns: boolean }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
