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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      accommodation: {
        Row: {
          accom_type: string | null
          area: string | null
          cost_range: string | null
          cover_image: string | null
          created_at: string | null
          description: string | null
          embedding: string | null
          featured: boolean | null
          id: string
          name: string
          slug: string
          strapline: string | null
          tags: string[] | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          accom_type?: string | null
          area?: string | null
          cost_range?: string | null
          cover_image?: string | null
          created_at?: string | null
          description?: string | null
          embedding?: string | null
          featured?: boolean | null
          id?: string
          name: string
          slug: string
          strapline?: string | null
          tags?: string[] | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          accom_type?: string | null
          area?: string | null
          cost_range?: string | null
          cover_image?: string | null
          created_at?: string | null
          description?: string | null
          embedding?: string | null
          featured?: boolean | null
          id?: string
          name?: string
          slug?: string
          strapline?: string | null
          tags?: string[] | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      accommodation_spaces: {
        Row: {
          accommodation_id: string
          relation: string | null
          space_id: string
        }
        Insert: {
          accommodation_id: string
          relation?: string | null
          space_id: string
        }
        Update: {
          accommodation_id?: string
          relation?: string | null
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accommodation_spaces_accommodation_id_fkey"
            columns: ["accommodation_id"]
            isOneToOne: false
            referencedRelation: "accommodation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accommodation_spaces_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          contribution: string | null
          created_at: string
          email: string
          first_name: string
          floor: string | null
          how_did_you_hear: string | null
          id: string
          last_name: string
          organization: string | null
          phone: string
          role: string | null
          social_handle: string | null
          stripe_payment_status: string | null
          what_are_you_working_on: string
          what_is_your_expertise: string
        }
        Insert: {
          contribution?: string | null
          created_at?: string
          email: string
          first_name: string
          floor?: string | null
          how_did_you_hear?: string | null
          id?: string
          last_name: string
          organization?: string | null
          phone: string
          role?: string | null
          social_handle?: string | null
          stripe_payment_status?: string | null
          what_are_you_working_on: string
          what_is_your_expertise: string
        }
        Update: {
          contribution?: string | null
          created_at?: string
          email?: string
          first_name?: string
          floor?: string | null
          how_did_you_hear?: string | null
          id?: string
          last_name?: string
          organization?: string | null
          phone?: string
          role?: string | null
          social_handle?: string | null
          stripe_payment_status?: string | null
          what_are_you_working_on?: string
          what_is_your_expertise?: string
        }
        Relationships: []
      }
      communities: {
        Row: {
          cover_image: string | null
          created_at: string | null
          description: string | null
          display_name: string | null
          display_order: number | null
          embedding: string | null
          events_url: string | null
          exclusivity: string | null
          featured: boolean | null
          id: string
          location_type: string | null
          luma_cal_ids: string[] | null
          luma_user_ids: string[] | null
          name: string
          pixel_art: string | null
          primary_area: string | null
          sectors: string[] | null
          size_band: string | null
          slug: string
          stages: string[] | null
          strapline: string | null
          tags: string[] | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          cover_image?: string | null
          created_at?: string | null
          description?: string | null
          display_name?: string | null
          display_order?: number | null
          embedding?: string | null
          events_url?: string | null
          exclusivity?: string | null
          featured?: boolean | null
          id?: string
          location_type?: string | null
          luma_cal_ids?: string[] | null
          luma_user_ids?: string[] | null
          name: string
          pixel_art?: string | null
          primary_area?: string | null
          sectors?: string[] | null
          size_band?: string | null
          slug: string
          stages?: string[] | null
          strapline?: string | null
          tags?: string[] | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          cover_image?: string | null
          created_at?: string | null
          description?: string | null
          display_name?: string | null
          display_order?: number | null
          embedding?: string | null
          events_url?: string | null
          exclusivity?: string | null
          featured?: boolean | null
          id?: string
          location_type?: string | null
          luma_cal_ids?: string[] | null
          luma_user_ids?: string[] | null
          name?: string
          pixel_art?: string | null
          primary_area?: string | null
          sectors?: string[] | null
          size_band?: string | null
          slug?: string
          stages?: string[] | null
          strapline?: string | null
          tags?: string[] | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      community_companies: {
        Row: {
          community_id: string
          company_id: string
          relation: string | null
        }
        Insert: {
          community_id: string
          company_id: string
          relation?: string | null
        }
        Update: {
          community_id?: string
          company_id?: string
          relation?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "community_companies_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      community_event_series: {
        Row: {
          community_id: string
          event_series_id: string
        }
        Insert: {
          community_id: string
          event_series_id: string
        }
        Update: {
          community_id?: string
          event_series_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_event_series_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_event_series_event_series_id_fkey"
            columns: ["event_series_id"]
            isOneToOne: false
            referencedRelation: "event_series"
            referencedColumns: ["id"]
          },
        ]
      }
      community_people: {
        Row: {
          community_id: string
          person_id: string
          role: string | null
        }
        Insert: {
          community_id: string
          person_id: string
          role?: string | null
        }
        Update: {
          community_id?: string
          person_id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "community_people_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_people_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      community_spaces: {
        Row: {
          community_id: string
          notes: string | null
          relation: string | null
          space_id: string
        }
        Insert: {
          community_id: string
          notes?: string | null
          relation?: string | null
          space_id: string
        }
        Update: {
          community_id?: string
          notes?: string | null
          relation?: string | null
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_spaces_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_spaces_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      community_vcs: {
        Row: {
          community_id: string
          relation: string | null
          vc_id: string
        }
        Insert: {
          community_id: string
          relation?: string | null
          vc_id: string
        }
        Update: {
          community_id?: string
          relation?: string | null
          vc_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_vcs_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_vcs_vc_id_fkey"
            columns: ["vc_id"]
            isOneToOne: false
            referencedRelation: "vcs"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          cover_image: string | null
          created_at: string | null
          description: string | null
          embedding: string | null
          featured: boolean | null
          founded_year: number | null
          id: string
          linkedin: string | null
          london_hq: boolean | null
          name: string
          sector: string | null
          slug: string
          stage: string | null
          strapline: string | null
          tags: string[] | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          cover_image?: string | null
          created_at?: string | null
          description?: string | null
          embedding?: string | null
          featured?: boolean | null
          founded_year?: number | null
          id?: string
          linkedin?: string | null
          london_hq?: boolean | null
          name: string
          sector?: string | null
          slug: string
          stage?: string | null
          strapline?: string | null
          tags?: string[] | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          cover_image?: string | null
          created_at?: string | null
          description?: string | null
          embedding?: string | null
          featured?: boolean | null
          founded_year?: number | null
          id?: string
          linkedin?: string | null
          london_hq?: boolean | null
          name?: string
          sector?: string | null
          slug?: string
          stage?: string | null
          strapline?: string | null
          tags?: string[] | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      company_people: {
        Row: {
          company_id: string
          person_id: string
          role: string | null
        }
        Insert: {
          company_id: string
          person_id: string
          role?: string | null
        }
        Update: {
          company_id?: string
          person_id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_people_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_people_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      company_spaces: {
        Row: {
          company_id: string
          notes: string | null
          relation: string | null
          space_id: string
        }
        Insert: {
          company_id: string
          notes?: string | null
          relation?: string | null
          space_id: string
        }
        Update: {
          company_id?: string
          notes?: string | null
          relation?: string | null
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_spaces_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_spaces_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      error_logs: {
        Row: {
          applicant_email: string | null
          created_at: string
          error_context: Json | null
          error_message: string
          id: string
        }
        Insert: {
          applicant_email?: string | null
          created_at?: string
          error_context?: Json | null
          error_message: string
          id?: string
        }
        Update: {
          applicant_email?: string | null
          created_at?: string
          error_context?: Json | null
          error_message?: string
          id?: string
        }
        Relationships: []
      }
      event_series: {
        Row: {
          cover_image: string | null
          created_at: string | null
          description: string | null
          embedding: string | null
          eventbrite_organiser_ids: string[] | null
          featured: boolean | null
          format: string | null
          free_or_paid: string | null
          frequency: string | null
          id: string
          luma_cal_ids: string[] | null
          luma_user_ids: string[] | null
          meetup_group_ids: string[] | null
          name: string
          sectors: string[] | null
          slug: string
          strapline: string | null
          tags: string[] | null
          typical_size: number | null
          updated_at: string | null
        }
        Insert: {
          cover_image?: string | null
          created_at?: string | null
          description?: string | null
          embedding?: string | null
          eventbrite_organiser_ids?: string[] | null
          featured?: boolean | null
          format?: string | null
          free_or_paid?: string | null
          frequency?: string | null
          id?: string
          luma_cal_ids?: string[] | null
          luma_user_ids?: string[] | null
          meetup_group_ids?: string[] | null
          name: string
          sectors?: string[] | null
          slug: string
          strapline?: string | null
          tags?: string[] | null
          typical_size?: number | null
          updated_at?: string | null
        }
        Update: {
          cover_image?: string | null
          created_at?: string | null
          description?: string | null
          embedding?: string | null
          eventbrite_organiser_ids?: string[] | null
          featured?: boolean | null
          format?: string | null
          free_or_paid?: string | null
          frequency?: string | null
          id?: string
          luma_cal_ids?: string[] | null
          luma_user_ids?: string[] | null
          meetup_group_ids?: string[] | null
          name?: string
          sectors?: string[] | null
          slug?: string
          strapline?: string | null
          tags?: string[] | null
          typical_size?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      event_series_people: {
        Row: {
          event_series_id: string
          person_id: string
          role: string | null
        }
        Insert: {
          event_series_id: string
          person_id: string
          role?: string | null
        }
        Update: {
          event_series_id?: string
          person_id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_series_people_event_series_id_fkey"
            columns: ["event_series_id"]
            isOneToOne: false
            referencedRelation: "event_series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_series_people_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      event_series_spaces: {
        Row: {
          event_series_id: string
          notes: string | null
          space_id: string
        }
        Insert: {
          event_series_id: string
          notes?: string | null
          space_id: string
        }
        Update: {
          event_series_id?: string
          notes?: string | null
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_series_spaces_event_series_id_fkey"
            columns: ["event_series_id"]
            isOneToOne: false
            referencedRelation: "event_series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_series_spaces_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          embedding: string | null
          featured: boolean | null
          id: string
          linkedin: string | null
          luma_user_ids: string[] | null
          name: string
          role: string | null
          slug: string
          tags: string[] | null
          twitter: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          embedding?: string | null
          featured?: boolean | null
          id?: string
          linkedin?: string | null
          luma_user_ids?: string[] | null
          name: string
          role?: string | null
          slug: string
          tags?: string[] | null
          twitter?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          embedding?: string | null
          featured?: boolean | null
          id?: string
          linkedin?: string | null
          luma_user_ids?: string[] | null
          name?: string
          role?: string | null
          slug?: string
          tags?: string[] | null
          twitter?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      programme_companies: {
        Row: {
          company_id: string
          programme_id: string
          relation: string | null
        }
        Insert: {
          company_id: string
          programme_id: string
          relation?: string | null
        }
        Update: {
          company_id?: string
          programme_id?: string
          relation?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "programme_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programme_companies_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
        ]
      }
      programme_people: {
        Row: {
          person_id: string
          programme_id: string
          role: string | null
        }
        Insert: {
          person_id: string
          programme_id: string
          role?: string | null
        }
        Update: {
          person_id?: string
          programme_id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "programme_people_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programme_people_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
        ]
      }
      programme_spaces: {
        Row: {
          programme_id: string
          space_id: string
        }
        Insert: {
          programme_id: string
          space_id: string
        }
        Update: {
          programme_id?: string
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "programme_spaces_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programme_spaces_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      programmes: {
        Row: {
          applications_open: boolean | null
          cohort_size: number | null
          cost_type: string | null
          cover_image: string | null
          created_at: string | null
          description: string | null
          embedding: string | null
          equity_pct: number | null
          featured: boolean | null
          id: string
          length_weeks: number | null
          luma_cal_ids: string[] | null
          name: string
          next_deadline: string | null
          programme_type: string | null
          sectors: string[] | null
          slug: string
          stages: string[] | null
          stipend_notes: string | null
          strapline: string | null
          tags: string[] | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          applications_open?: boolean | null
          cohort_size?: number | null
          cost_type?: string | null
          cover_image?: string | null
          created_at?: string | null
          description?: string | null
          embedding?: string | null
          equity_pct?: number | null
          featured?: boolean | null
          id?: string
          length_weeks?: number | null
          luma_cal_ids?: string[] | null
          name: string
          next_deadline?: string | null
          programme_type?: string | null
          sectors?: string[] | null
          slug: string
          stages?: string[] | null
          stipend_notes?: string | null
          strapline?: string | null
          tags?: string[] | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          applications_open?: boolean | null
          cohort_size?: number | null
          cost_type?: string | null
          cover_image?: string | null
          created_at?: string | null
          description?: string | null
          embedding?: string | null
          equity_pct?: number | null
          featured?: boolean | null
          id?: string
          length_weeks?: number | null
          luma_cal_ids?: string[] | null
          name?: string
          next_deadline?: string | null
          programme_type?: string | null
          sectors?: string[] | null
          slug?: string
          stages?: string[] | null
          stipend_notes?: string | null
          strapline?: string | null
          tags?: string[] | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      spaces: {
        Row: {
          access_type: string | null
          address: string | null
          area: string | null
          capacity: number | null
          cost_notes: string | null
          cost_type: string | null
          cover_image: string | null
          created_at: string | null
          crowd_tags: string[] | null
          description: string | null
          display_name: string | null
          display_order: number | null
          embedding: string | null
          events_url: string | null
          featured: boolean | null
          id: string
          lat: number | null
          lng: number | null
          luma_cal_ids: string[] | null
          name: string
          pixel_art: string | null
          slug: string
          strapline: string | null
          tags: string[] | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          access_type?: string | null
          address?: string | null
          area?: string | null
          capacity?: number | null
          cost_notes?: string | null
          cost_type?: string | null
          cover_image?: string | null
          created_at?: string | null
          crowd_tags?: string[] | null
          description?: string | null
          display_name?: string | null
          display_order?: number | null
          embedding?: string | null
          events_url?: string | null
          featured?: boolean | null
          id?: string
          lat?: number | null
          lng?: number | null
          luma_cal_ids?: string[] | null
          name: string
          pixel_art?: string | null
          slug: string
          strapline?: string | null
          tags?: string[] | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          access_type?: string | null
          address?: string | null
          area?: string | null
          capacity?: number | null
          cost_notes?: string | null
          cost_type?: string | null
          cover_image?: string | null
          created_at?: string | null
          crowd_tags?: string[] | null
          description?: string | null
          display_name?: string | null
          display_order?: number | null
          embedding?: string | null
          events_url?: string | null
          featured?: boolean | null
          id?: string
          lat?: number | null
          lng?: number | null
          luma_cal_ids?: string[] | null
          name?: string
          pixel_art?: string | null
          slug?: string
          strapline?: string | null
          tags?: string[] | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      vc_companies: {
        Row: {
          company_id: string
          relation: string | null
          vc_id: string
        }
        Insert: {
          company_id: string
          relation?: string | null
          vc_id: string
        }
        Update: {
          company_id?: string
          relation?: string | null
          vc_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vc_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vc_companies_vc_id_fkey"
            columns: ["vc_id"]
            isOneToOne: false
            referencedRelation: "vcs"
            referencedColumns: ["id"]
          },
        ]
      }
      vc_people: {
        Row: {
          person_id: string
          role: string | null
          vc_id: string
        }
        Insert: {
          person_id: string
          role?: string | null
          vc_id: string
        }
        Update: {
          person_id?: string
          role?: string | null
          vc_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vc_people_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vc_people_vc_id_fkey"
            columns: ["vc_id"]
            isOneToOne: false
            referencedRelation: "vcs"
            referencedColumns: ["id"]
          },
        ]
      }
      vcs: {
        Row: {
          check_max: number | null
          check_min: number | null
          cover_image: string | null
          created_at: string | null
          description: string | null
          embedding: string | null
          featured: boolean | null
          id: string
          london_team: boolean | null
          luma_cal_ids: string[] | null
          luma_user_ids: string[] | null
          name: string
          sectors: string[] | null
          slug: string
          stages: string[] | null
          strapline: string | null
          tags: string[] | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          check_max?: number | null
          check_min?: number | null
          cover_image?: string | null
          created_at?: string | null
          description?: string | null
          embedding?: string | null
          featured?: boolean | null
          id?: string
          london_team?: boolean | null
          luma_cal_ids?: string[] | null
          luma_user_ids?: string[] | null
          name: string
          sectors?: string[] | null
          slug: string
          stages?: string[] | null
          strapline?: string | null
          tags?: string[] | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          check_max?: number | null
          check_min?: number | null
          cover_image?: string | null
          created_at?: string | null
          description?: string | null
          embedding?: string | null
          featured?: boolean | null
          id?: string
          london_team?: boolean | null
          luma_cal_ids?: string[] | null
          luma_user_ids?: string[] | null
          name?: string
          sectors?: string[] | null
          slug?: string
          stages?: string[] | null
          strapline?: string | null
          tags?: string[] | null
          updated_at?: string | null
          website?: string | null
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
