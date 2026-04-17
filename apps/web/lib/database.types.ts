npm warn exec The following package was not found and will be installed: supabase@2.92.0
Connecting to db 5432
v0.96.4: Pulling from supabase/postgres-meta
2705dbac373a: Pulling fs layer
1dbbb2db815c: Pulling fs layer
c8f3ed040281: Pulling fs layer
1e2be9f8a111: Pulling fs layer
78e1f2f65955: Pulling fs layer
f6bc6564f93a: Pulling fs layer
f4c396aa930d: Pulling fs layer
9c6243177b72: Pulling fs layer
53fdaf778fe7: Pulling fs layer
49981ae38b77: Pulling fs layer
2705dbac373a: Download complete
c8f3ed040281: Download complete
9c6243177b72: Download complete
49981ae38b77: Download complete
dd0e679da763: Download complete
f6bc6564f93a: Download complete
78e1f2f65955: Download complete
f4c396aa930d: Download complete
1e2be9f8a111: Download complete
53fdaf778fe7: Download complete
1dbbb2db815c: Download complete
c8f3ed040281: Pull complete
1dbbb2db815c: Pull complete
f6bc6564f93a: Pull complete
78e1f2f65955: Pull complete
f4c396aa930d: Pull complete
1e2be9f8a111: Pull complete
9c6243177b72: Pull complete
2705dbac373a: Pull complete
49981ae38b77: Pull complete
53fdaf778fe7: Pull complete
Digest: sha256:4dd3e0ff3e9a0f9f62dd1a1a827f124645549b439ddb2a53598575744585e32d
Status: Downloaded newer image for public.ecr.aws/supabase/postgres-meta:v0.96.4
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      benefits_screenings: {
        Row: {
          answers: Json
          created_at: string
          created_by: string
          id: string
          org_id: string
          recipient_id: string
          results: Json
        }
        Insert: {
          answers: Json
          created_at?: string
          created_by: string
          id?: string
          org_id: string
          recipient_id: string
          results: Json
        }
        Update: {
          answers?: Json
          created_at?: string
          created_by?: string
          id?: string
          org_id?: string
          recipient_id?: string
          results?: Json
        }
        Relationships: [
          {
            foreignKeyName: "benefits_screenings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "benefits_screenings_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "care_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      burnout_checkins: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          org_id: string
          sleep_score: number
          stress_score: number
          support_score: number
          user_id: string
          week_stamp: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          org_id: string
          sleep_score: number
          stress_score: number
          support_score: number
          user_id: string
          week_stamp: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          org_id?: string
          sleep_score?: number
          stress_score?: number
          support_score?: number
          user_id?: string
          week_stamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "burnout_checkins_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      care_briefs: {
        Row: {
          content: Json
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          includes: string[]
          org_id: string
          recipient_id: string
          revoked: boolean
          share_token: string
          title: string
        }
        Insert: {
          content: Json
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          includes?: string[]
          org_id: string
          recipient_id: string
          revoked?: boolean
          share_token?: string
          title?: string
        }
        Update: {
          content?: Json
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          includes?: string[]
          org_id?: string
          recipient_id?: string
          revoked?: boolean
          share_token?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_briefs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_briefs_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "care_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      care_event_comments: {
        Row: {
          author_id: string
          body: string
          care_event_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          org_id: string
        }
        Insert: {
          author_id: string
          body: string
          care_event_id: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          org_id: string
        }
        Update: {
          author_id?: string
          body?: string
          care_event_id?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_event_comments_care_event_id_fkey"
            columns: ["care_event_id"]
            isOneToOne: false
            referencedRelation: "care_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_event_comments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      care_events: {
        Row: {
          actor_id: string
          created_at: string
          entry_kind: Database["public"]["Enums"]["entry_kind"]
          event_type: Database["public"]["Enums"]["event_type"]
          flagged: boolean
          id: string
          missed: boolean | null
          occurred_at: string
          org_id: string
          payload: Json
          recipient_id: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          entry_kind?: Database["public"]["Enums"]["entry_kind"]
          event_type: Database["public"]["Enums"]["event_type"]
          flagged?: boolean
          id?: string
          missed?: boolean | null
          occurred_at?: string
          org_id: string
          payload?: Json
          recipient_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          entry_kind?: Database["public"]["Enums"]["entry_kind"]
          event_type?: Database["public"]["Enums"]["event_type"]
          flagged?: boolean
          id?: string
          missed?: boolean | null
          occurred_at?: string
          org_id?: string
          payload?: Json
          recipient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_events_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "care_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      care_recipients: {
        Row: {
          allergies: Json
          created_at: string
          diagnoses: Json
          id: string
          identity_token: string
          org_id: string
          preferences: Json
        }
        Insert: {
          allergies?: Json
          created_at?: string
          diagnoses?: Json
          id?: string
          identity_token: string
          org_id: string
          preferences?: Json
        }
        Update: {
          allergies?: Json
          created_at?: string
          diagnoses?: Json
          id?: string
          identity_token?: string
          org_id?: string
          preferences?: Json
        }
        Relationships: [
          {
            foreignKeyName: "care_recipients_identity_token_fkey"
            columns: ["identity_token"]
            isOneToOne: false
            referencedRelation: "identity_vault"
            referencedColumns: ["token"]
          },
          {
            foreignKeyName: "care_recipients_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      coverage_windows: {
        Row: {
          covered: boolean
          created_at: string
          day_of_week: number | null
          ends_at: string
          id: string
          label: string | null
          org_id: string
          recipient_id: string
          recurring: boolean
          required_role: string | null
          shift_id: string | null
          starts_at: string
        }
        Insert: {
          covered?: boolean
          created_at?: string
          day_of_week?: number | null
          ends_at: string
          id?: string
          label?: string | null
          org_id: string
          recipient_id: string
          recurring?: boolean
          required_role?: string | null
          shift_id?: string | null
          starts_at: string
        }
        Update: {
          covered?: boolean
          created_at?: string
          day_of_week?: number | null
          ends_at?: string
          id?: string
          label?: string | null
          org_id?: string
          recipient_id?: string
          recurring?: boolean
          required_role?: string | null
          shift_id?: string | null
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coverage_windows_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coverage_windows_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "care_recipients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coverage_windows_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      display_names: {
        Row: {
          cached_at: string
          expires_at: string
          full_name: string
          org_id: string
          recipient_id: string
        }
        Insert: {
          cached_at?: string
          expires_at?: string
          full_name: string
          org_id: string
          recipient_id: string
        }
        Update: {
          cached_at?: string
          expires_at?: string
          full_name?: string
          org_id?: string
          recipient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "display_names_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "display_names_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: true
            referencedRelation: "care_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          display_name: string
          doc_type: string
          extracted_text: string | null
          extracted_text_tsv: unknown
          file_size: number | null
          id: string
          org_id: string
          recipient_id: string
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          display_name: string
          doc_type: string
          extracted_text?: string | null
          extracted_text_tsv?: unknown
          file_size?: number | null
          id?: string
          org_id: string
          recipient_id: string
          storage_path: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          display_name?: string
          doc_type?: string
          extracted_text?: string | null
          extracted_text_tsv?: unknown
          file_size?: number | null
          id?: string
          org_id?: string
          recipient_id?: string
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "care_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      eol_plans: {
        Row: {
          attorney_contact: string | null
          attorney_name: string | null
          created_at: string
          created_by: string
          funeral_pref: string | null
          healthcare_proxy: string | null
          id: string
          legacy_message: string | null
          org_id: string
          recipient_id: string
          resuscitation_pref: string | null
          updated_at: string
        }
        Insert: {
          attorney_contact?: string | null
          attorney_name?: string | null
          created_at?: string
          created_by: string
          funeral_pref?: string | null
          healthcare_proxy?: string | null
          id?: string
          legacy_message?: string | null
          org_id: string
          recipient_id: string
          resuscitation_pref?: string | null
          updated_at?: string
        }
        Update: {
          attorney_contact?: string | null
          attorney_name?: string | null
          created_at?: string
          created_by?: string
          funeral_pref?: string | null
          healthcare_proxy?: string | null
          id?: string
          legacy_message?: string | null
          org_id?: string
          recipient_id?: string
          resuscitation_pref?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "eol_plans_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eol_plans_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: true
            referencedRelation: "care_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          currency: string
          description: string
          id: string
          incurred_at: string
          logged_by: string
          org_id: string
          paid_by_name: string | null
          receipt_url: string | null
          recipient_id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          currency?: string
          description: string
          id?: string
          incurred_at?: string
          logged_by: string
          org_id: string
          paid_by_name?: string | null
          receipt_url?: string | null
          recipient_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          currency?: string
          description?: string
          id?: string
          incurred_at?: string
          logged_by?: string
          org_id?: string
          paid_by_name?: string | null
          receipt_url?: string | null
          recipient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "care_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      identity_vault: {
        Row: {
          contact_info: Json
          created_at: string
          dob: string | null
          full_name: string
          org_id: string
          token: string
        }
        Insert: {
          contact_info?: Json
          created_at?: string
          dob?: string | null
          full_name: string
          org_id: string
          token?: string
        }
        Update: {
          contact_info?: Json
          created_at?: string
          dob?: string | null
          full_name?: string
          org_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "identity_vault_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_tokens: {
        Row: {
          consumed_at: string | null
          email: string
          expires_at: string
          id: string
          membership_id: string
          token: string
        }
        Insert: {
          consumed_at?: string | null
          email: string
          expires_at?: string
          id?: string
          membership_id: string
          token?: string
        }
        Update: {
          consumed_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          membership_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invite_tokens_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_reactions: {
        Row: {
          created_at: string
          event_id: string
          id: string
          note: string | null
          reaction: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          note?: string | null
          reaction: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          note?: string | null
          reaction?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_reactions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "care_events"
            referencedColumns: ["id"]
          },
        ]
      }
      medication_schedules: {
        Row: {
          active: boolean
          assigned_to: string | null
          created_at: string
          days_of_week: number[]
          id: string
          medication_id: string
          recipient_id: string
          time_of_day: string
        }
        Insert: {
          active?: boolean
          assigned_to?: string | null
          created_at?: string
          days_of_week?: number[]
          id?: string
          medication_id: string
          recipient_id: string
          time_of_day: string
        }
        Update: {
          active?: boolean
          assigned_to?: string | null
          created_at?: string
          days_of_week?: number[]
          id?: string
          medication_id?: string
          recipient_id?: string
          time_of_day?: string
        }
        Relationships: [
          {
            foreignKeyName: "medication_schedules_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_schedules_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "care_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      medications: {
        Row: {
          active: boolean
          brand_name: string | null
          created_at: string
          dosage: string
          drug_name: string
          form: string | null
          id: string
          instructions: string | null
          last_refill_date: string | null
          org_id: string
          pharmacy: string | null
          pharmacy_phone: string | null
          prescriber: string | null
          recipient_id: string
          refills_remaining: number | null
          scan_source: string
          supply_days_remaining: number | null
        }
        Insert: {
          active?: boolean
          brand_name?: string | null
          created_at?: string
          dosage: string
          drug_name: string
          form?: string | null
          id?: string
          instructions?: string | null
          last_refill_date?: string | null
          org_id: string
          pharmacy?: string | null
          pharmacy_phone?: string | null
          prescriber?: string | null
          recipient_id: string
          refills_remaining?: number | null
          scan_source?: string
          supply_days_remaining?: number | null
        }
        Update: {
          active?: boolean
          brand_name?: string | null
          created_at?: string
          dosage?: string
          drug_name?: string
          form?: string | null
          id?: string
          instructions?: string | null
          last_refill_date?: string | null
          org_id?: string
          pharmacy?: string | null
          pharmacy_phone?: string | null
          prescriber?: string | null
          recipient_id?: string
          refills_remaining?: number | null
          scan_source?: string
          supply_days_remaining?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "medications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "care_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          accepted_at: string | null
          id: string
          invited_at: string
          org_id: string
          recipient_id: string | null
          role: Database["public"]["Enums"]["member_role"]
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          id?: string
          invited_at?: string
          org_id: string
          recipient_id?: string | null
          role: Database["public"]["Enums"]["member_role"]
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          id?: string
          invited_at?: string
          org_id?: string
          recipient_id?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "care_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      message_thread_members: {
        Row: {
          joined_at: string
          last_read_at: string | null
          thread_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          last_read_at?: string | null
          thread_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          last_read_at?: string | null
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_thread_members_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      message_threads: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string | null
          org_id: string
          thread_type: Database["public"]["Enums"]["message_thread_type"]
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name?: string | null
          org_id: string
          thread_type: Database["public"]["Enums"]["message_thread_type"]
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string | null
          org_id?: string
          thread_type?: Database["public"]["Enums"]["message_thread_type"]
        }
        Relationships: [
          {
            foreignKeyName: "message_threads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          sender_id: string
          thread_id: string
        }
        Insert: {
          body: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          sender_id: string
          thread_id: string
        }
        Update: {
          body?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          sender_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      mood_entries: {
        Row: {
          author_id: string
          created_at: string
          id: string
          mood: string
          note: string | null
          occurred_at: string
          org_id: string
          recipient_id: string
        }
        Insert: {
          author_id: string
          created_at?: string
          id?: string
          mood: string
          note?: string | null
          occurred_at?: string
          org_id: string
          recipient_id: string
        }
        Update: {
          author_id?: string
          created_at?: string
          id?: string
          mood?: string
          note?: string | null
          occurred_at?: string
          org_id?: string
          recipient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mood_entries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mood_entries_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "care_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          care_event_comments: boolean
          digest_frequency: string
          email_enabled: boolean
          push_enabled: boolean
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          sms_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          care_event_comments?: boolean
          digest_frequency?: string
          email_enabled?: boolean
          push_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          sms_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          care_event_comments?: boolean
          digest_frequency?: string
          email_enabled?: boolean
          push_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          sms_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ocr_jobs: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          id: string
          image_url: string
          medication_id: string | null
          org_id: string
          parsed_data: Json | null
          raw_text: string | null
          recipient_id: string
          status: Database["public"]["Enums"]["ocr_status"]
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          image_url: string
          medication_id?: string | null
          org_id: string
          parsed_data?: Json | null
          raw_text?: string | null
          recipient_id: string
          status?: Database["public"]["Enums"]["ocr_status"]
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string
          medication_id?: string | null
          org_id?: string
          parsed_data?: Json | null
          raw_text?: string | null
          recipient_id?: string
          status?: Database["public"]["Enums"]["ocr_status"]
        }
        Relationships: [
          {
            foreignKeyName: "ocr_jobs_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_jobs_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "care_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          org_type: Database["public"]["Enums"]["org_type"]
          plan: Database["public"]["Enums"]["org_plan"]
          stripe_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          org_type: Database["public"]["Enums"]["org_type"]
          plan?: Database["public"]["Enums"]["org_plan"]
          stripe_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          org_type?: Database["public"]["Enums"]["org_type"]
          plan?: Database["public"]["Enums"]["org_plan"]
          stripe_id?: string | null
        }
        Relationships: []
      }
      outer_circle_claims: {
        Row: {
          claimer_email: string
          claimer_name: string
          confirmed: boolean
          created_at: string
          id: string
          note: string | null
          request_id: string
          slot_date: string | null
        }
        Insert: {
          claimer_email: string
          claimer_name: string
          confirmed?: boolean
          created_at?: string
          id?: string
          note?: string | null
          request_id: string
          slot_date?: string | null
        }
        Update: {
          claimer_email?: string
          claimer_name?: string
          confirmed?: boolean
          created_at?: string
          id?: string
          note?: string | null
          request_id?: string
          slot_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outer_circle_claims_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "outer_circle_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      outer_circle_requests: {
        Row: {
          active: boolean
          created_at: string
          created_by: string
          description: string | null
          id: string
          needed_by: string | null
          org_id: string
          recipient_id: string
          request_type: Database["public"]["Enums"]["request_type"]
          share_token: string
          slots_filled: number
          slots_total: number
          title: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          needed_by?: string | null
          org_id: string
          recipient_id: string
          request_type: Database["public"]["Enums"]["request_type"]
          share_token?: string
          slots_filled?: number
          slots_total?: number
          title: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          needed_by?: string | null
          org_id?: string
          recipient_id?: string
          request_type?: Database["public"]["Enums"]["request_type"]
          share_token?: string
          slots_filled?: number
          slots_total?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "outer_circle_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outer_circle_requests_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "care_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          auth_user_id: string
          created_at: string
          id: string
          platform: string
          token: string
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          id?: string
          platform: string
          token: string
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          id?: string
          platform?: string
          token?: string
        }
        Relationships: []
      }
      shifts: {
        Row: {
          assignee_user_id: string | null
          claimed_at: string | null
          confirmed_at: string | null
          created_at: string
          created_by: string
          end_at: string
          id: string
          notes: string | null
          org_id: string
          recipient_id: string
          recurrence: Json | null
          recurring: boolean
          start_at: string
          status: Database["public"]["Enums"]["shift_status"]
        }
        Insert: {
          assignee_user_id?: string | null
          claimed_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by: string
          end_at: string
          id?: string
          notes?: string | null
          org_id: string
          recipient_id: string
          recurrence?: Json | null
          recurring?: boolean
          start_at: string
          status?: Database["public"]["Enums"]["shift_status"]
        }
        Update: {
          assignee_user_id?: string | null
          claimed_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string
          end_at?: string
          id?: string
          notes?: string | null
          org_id?: string
          recipient_id?: string
          recurrence?: Json | null
          recurring?: boolean
          start_at?: string
          status?: Database["public"]["Enums"]["shift_status"]
        }
        Relationships: [
          {
            foreignKeyName: "shifts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "care_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      symptom_readings: {
        Row: {
          appetite: string | null
          id: string
          logged_by: string
          mobility: string | null
          mood: string | null
          notes: string | null
          org_id: string
          pain_level: number | null
          recipient_id: string
          recorded_at: string
        }
        Insert: {
          appetite?: string | null
          id?: string
          logged_by: string
          mobility?: string | null
          mood?: string | null
          notes?: string | null
          org_id: string
          pain_level?: number | null
          recipient_id: string
          recorded_at?: string
        }
        Update: {
          appetite?: string | null
          id?: string
          logged_by?: string
          mobility?: string | null
          mood?: string | null
          notes?: string | null
          org_id?: string
          pain_level?: number | null
          recipient_id?: string
          recorded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "symptom_readings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "symptom_readings_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "care_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          onboarded: boolean
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          onboarded?: boolean
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          onboarded?: boolean
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invite: {
        Args: { p_email: string; p_token: string; p_user_id: string }
        Returns: Database["public"]["CompositeTypes"]["invite_accept_result"]
        SetofOptions: {
          from: "*"
          to: "invite_accept_result"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_outer_circle_slot: {
        Args: {
          p_date?: string
          p_email: string
          p_name: string
          p_request_id: string
        }
        Returns: string
      }
      find_dm_thread: {
        Args: { p_org_id: string; p_user_a: string; p_user_b: string }
        Returns: string
      }
      is_thread_member: { Args: { p_thread_id: string }; Returns: boolean }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      user_can_access_recipient: {
        Args: { p_recipient_id: string }
        Returns: boolean
      }
      user_in_org: { Args: { p_org_id: string }; Returns: boolean }
      user_is_coordinator_for: {
        Args: { p_recipient_id: string }
        Returns: boolean
      }
      user_is_org_coordinator: { Args: { p_org_id: string }; Returns: boolean }
      user_is_org_member: { Args: { p_org_id: string }; Returns: boolean }
    }
    Enums: {
      entry_kind: "human" | "system"
      event_type:
        | "journal"
        | "medication"
        | "shift"
        | "appointment"
        | "symptom"
        | "task"
        | "expense"
        | "handoff"
      member_role: "coordinator" | "caregiver" | "supporter" | "aide"
      message_thread_type: "dm" | "group"
      ocr_status:
        | "pending"
        | "processing"
        | "needs_review"
        | "confirmed"
        | "failed"
      org_plan: "free" | "family" | "professional" | "enterprise"
      org_type: "family" | "agency" | "institution" | "employer"
      request_type: "meal" | "transport" | "errand" | "visit" | "other"
      shift_status:
        | "open"
        | "claimed"
        | "confirmed"
        | "completed"
        | "missed"
        | "scheduled"
        | "in_progress"
        | "cancelled"
    }
    CompositeTypes: {
      invite_accept_result: {
        success: boolean | null
        error: string | null
      }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      entry_kind: ["human", "system"],
      event_type: [
        "journal",
        "medication",
        "shift",
        "appointment",
        "symptom",
        "task",
        "expense",
        "handoff",
      ],
      member_role: ["coordinator", "caregiver", "supporter", "aide"],
      message_thread_type: ["dm", "group"],
      ocr_status: [
        "pending",
        "processing",
        "needs_review",
        "confirmed",
        "failed",
      ],
      org_plan: ["free", "family", "professional", "enterprise"],
      org_type: ["family", "agency", "institution", "employer"],
      request_type: ["meal", "transport", "errand", "visit", "other"],
      shift_status: [
        "open",
        "claimed",
        "confirmed",
        "completed",
        "missed",
        "scheduled",
        "in_progress",
        "cancelled",
      ],
    },
  },
} as const

