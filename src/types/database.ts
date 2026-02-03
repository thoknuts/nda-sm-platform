export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'admin' | 'crew' | 'organizer'
export type EventGuestStatus = 'invited' | 'signed_pending_verification' | 'verified'
export type Language = 'no' | 'en'
export type PhoneChangeVia = 'kiosk' | 'admin'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          user_id: string
          role: UserRole
          sm_username: string
          full_name: string | null
          pin_hash: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          role: UserRole
          sm_username: string
          full_name?: string | null
          pin_hash?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          role?: UserRole
          sm_username?: string
          full_name?: string | null
          pin_hash?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      guests: {
        Row: {
          id: string
          phone: string
          first_name: string | null
          last_name: string | null
          sm_username: string | null
          email: string | null
          location: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          phone: string
          first_name?: string | null
          last_name?: string | null
          sm_username?: string | null
          email?: string | null
          location?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          phone?: string
          first_name?: string | null
          last_name?: string | null
          sm_username?: string | null
          email?: string | null
          location?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      guests_phone_history: {
        Row: {
          id: string
          guest_id: string
          old_phone: string
          new_phone: string
          changed_at: string
          changed_via: PhoneChangeVia
        }
        Insert: {
          id?: string
          guest_id: string
          old_phone: string
          new_phone: string
          changed_at?: string
          changed_via: PhoneChangeVia
        }
        Update: {
          id?: string
          guest_id?: string
          old_phone?: string
          new_phone?: string
          changed_at?: string
          changed_via?: PhoneChangeVia
        }
      }
      events: {
        Row: {
          id: string
          name: string
          event_date: string
          end_date: string
          nda_text_no: string
          nda_text_en: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          event_date: string
          end_date: string
          nda_text_no: string
          nda_text_en: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          event_date?: string
          end_date?: string
          nda_text_no?: string
          nda_text_en?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      event_guests: {
        Row: {
          id: string
          event_id: string
          sm_username: string
          first_name: string | null
          last_name: string | null
          phone: string | null
          email: string | null
          status: EventGuestStatus
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          event_id: string
          sm_username: string
          first_name?: string | null
          last_name?: string | null
          phone?: string | null
          email?: string | null
          status?: EventGuestStatus
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          sm_username?: string
          first_name?: string | null
          last_name?: string | null
          phone?: string | null
          email?: string | null
          status?: EventGuestStatus
          created_at?: string
          updated_at?: string
        }
      }
      crew_event_access: {
        Row: {
          id: string
          event_id: string
          crew_user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          crew_user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          crew_user_id?: string
          created_at?: string
        }
      }
      crew_invites: {
        Row: {
          id: string
          email: string
          created_by: string
          expires_at: string
          revoked_at: string | null
          used_at: string | null
          used_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          created_by: string
          expires_at: string
          revoked_at?: string | null
          used_at?: string | null
          used_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          created_by?: string
          expires_at?: string
          revoked_at?: string | null
          used_at?: string | null
          used_by?: string | null
          created_at?: string
        }
      }
      app_config: {
        Row: {
          id: number
          privacy_text_no: string
          privacy_text_en: string
          privacy_version: number
          auto_lock_enabled: boolean
          auto_lock_minutes: number
          updated_at: string
        }
        Insert: {
          id?: number
          privacy_text_no: string
          privacy_text_en: string
          privacy_version?: number
          auto_lock_enabled?: boolean
          auto_lock_minutes?: number
          updated_at?: string
        }
        Update: {
          id?: number
          privacy_text_no?: string
          privacy_text_en?: string
          privacy_version?: number
          auto_lock_enabled?: boolean
          auto_lock_minutes?: number
          updated_at?: string
        }
      }
      nda_signatures: {
        Row: {
          id: string
          event_id: string
          guest_id: string
          language: Language
          nda_text_snapshot: string
          nda_text_version: number
          read_confirmed: boolean
          privacy_accepted: boolean
          privacy_text_snapshot: string
          privacy_version: number
          signed_at: string
          signature_storage_path: string
          pdf_storage_path: string | null
          pdf_sha256: string | null
          verified_at: string | null
          verified_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          event_id: string
          guest_id: string
          language: Language
          nda_text_snapshot: string
          nda_text_version?: number
          read_confirmed: boolean
          privacy_accepted: boolean
          privacy_text_snapshot: string
          privacy_version: number
          signed_at?: string
          signature_storage_path: string
          pdf_storage_path?: string | null
          pdf_sha256?: string | null
          verified_at?: string | null
          verified_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          guest_id?: string
          language?: Language
          nda_text_snapshot?: string
          nda_text_version?: number
          read_confirmed?: boolean
          privacy_accepted?: boolean
          privacy_text_snapshot?: string
          privacy_version?: number
          signed_at?: string
          signature_storage_path?: string
          pdf_storage_path?: string | null
          pdf_sha256?: string | null
          verified_at?: string | null
          verified_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      kiosk_sessions: {
        Row: {
          id: string
          event_id: string
          crew_user_id: string
          token_hash: string
          expires_at: string
          created_at: string
          revoked_at: string | null
        }
        Insert: {
          id?: string
          event_id: string
          crew_user_id: string
          token_hash: string
          expires_at: string
          created_at?: string
          revoked_at?: string | null
        }
        Update: {
          id?: string
          event_id?: string
          crew_user_id?: string
          token_hash?: string
          expires_at?: string
          created_at?: string
          revoked_at?: string | null
        }
      }
      audit_log: {
        Row: {
          id: string
          actor_user_id: string | null
          action: string
          entity_type: string
          entity_id: string | null
          meta: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          actor_user_id?: string | null
          action: string
          entity_type: string
          entity_id?: string | null
          meta?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          actor_user_id?: string | null
          action?: string
          entity_type?: string
          entity_id?: string | null
          meta?: Json | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_role: UserRole
      event_guest_status: EventGuestStatus
      language: Language
      phone_change_via: PhoneChangeVia
    }
  }
}
