// AUTO-GENERATED: supabase gen types typescript --linked --schema public. Do not edit by hand.
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
      academic_periods: {
        Row: {
          close_at: string
          created_at: string
          created_by: string | null
          id: string
          is_current: boolean
          label: string | null
          open_at: string
          results_released_at: string | null
          school_year: string | null
          semester: number
          start_year: number
          updated_at: string
        }
        Insert: {
          close_at: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_current?: boolean
          label?: string | null
          open_at: string
          results_released_at?: string | null
          school_year?: string | null
          semester: number
          start_year: number
          updated_at?: string
        }
        Update: {
          close_at?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_current?: boolean
          label?: string | null
          open_at?: string
          results_released_at?: string | null
          school_year?: string | null
          semester?: number
          start_year?: number
          updated_at?: string
        }
        Relationships: []
      }
      activity_logs: {
        Row: {
          action: string
          created_at: string
          description: string | null
          entity_id: string | null
          entity_type: string | null
          id: number
          ip_address: string | null
          metadata: Json
          module: string
          role: Database["public"]["Enums"]["app_role"] | null
          user_agent: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: never
          ip_address?: string | null
          metadata?: Json
          module: string
          role?: Database["public"]["Enums"]["app_role"] | null
          user_agent?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: never
          ip_address?: string | null
          metadata?: Json
          module?: string
          role?: Database["public"]["Enums"]["app_role"] | null
          user_agent?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      departments: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      evaluation_answers: {
        Row: {
          attempt_id: string
          category_id: string | null
          category_name: string
          created_at: string
          id: string
          question_id: string
          question_text: string
          question_title: string
          rating: number
          rating_label: string | null
          scale_max: number
          updated_at: string
        }
        Insert: {
          attempt_id: string
          category_id?: string | null
          category_name: string
          created_at?: string
          id?: string
          question_id: string
          question_text: string
          question_title: string
          rating: number
          rating_label?: string | null
          scale_max?: number
          updated_at?: string
        }
        Update: {
          attempt_id?: string
          category_id?: string | null
          category_name?: string
          created_at?: string
          id?: string
          question_id?: string
          question_text?: string
          question_title?: string
          rating?: number
          rating_label?: string | null
          scale_max?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "enrollment_overview"
            referencedColumns: ["attempt_id"]
          },
          {
            foreignKeyName: "evaluation_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "evaluation_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_answers_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "category_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_answers_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "question_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "question_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_attempts: {
        Row: {
          academic_period_id: string
          average_rating: number | null
          created_at: string
          id: string
          offering_id: string
          source: string
          started_at: string
          status: Database["public"]["Enums"]["evaluation_status"]
          student_id: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          academic_period_id: string
          average_rating?: number | null
          created_at?: string
          id?: string
          offering_id: string
          source?: string
          started_at?: string
          status?: Database["public"]["Enums"]["evaluation_status"]
          student_id: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          academic_period_id?: string
          average_rating?: number | null
          created_at?: string
          id?: string
          offering_id?: string
          source?: string
          started_at?: string
          status?: Database["public"]["Enums"]["evaluation_status"]
          student_id?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_attempts_enrollment_fkey"
            columns: ["offering_id", "student_id"]
            isOneToOne: false
            referencedRelation: "enrollment_overview"
            referencedColumns: ["offering_id", "student_id"]
          },
          {
            foreignKeyName: "evaluation_attempts_enrollment_fkey"
            columns: ["offering_id", "student_id"]
            isOneToOne: false
            referencedRelation: "subject_enrollments"
            referencedColumns: ["offering_id", "student_id"]
          },
          {
            foreignKeyName: "evaluation_attempts_offering_period_fkey"
            columns: ["offering_id", "academic_period_id"]
            isOneToOne: false
            referencedRelation: "offering_overview"
            referencedColumns: ["id", "academic_period_id"]
          },
          {
            foreignKeyName: "evaluation_attempts_offering_period_fkey"
            columns: ["offering_id", "academic_period_id"]
            isOneToOne: false
            referencedRelation: "subject_offerings"
            referencedColumns: ["id", "academic_period_id"]
          },
        ]
      }
      evaluation_comments: {
        Row: {
          attempt_id: string
          comment: string
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          attempt_id: string
          comment: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          attempt_id?: string
          comment?: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_comments_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: true
            referencedRelation: "enrollment_overview"
            referencedColumns: ["attempt_id"]
          },
          {
            foreignKeyName: "evaluation_comments_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: true
            referencedRelation: "evaluation_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      faculty: {
        Row: {
          birthday: string | null
          created_at: string
          created_by: string | null
          date_started: string | null
          department_id: string
          email: string
          faculty_number: string
          first_name: string
          id: string
          is_active: boolean
          last_name: string
          middle_name: string | null
          photo_path: string | null
          profile_id: string | null
          program_id: string
          updated_at: string
        }
        Insert: {
          birthday?: string | null
          created_at?: string
          created_by?: string | null
          date_started?: string | null
          department_id: string
          email: string
          faculty_number: string
          first_name: string
          id?: string
          is_active?: boolean
          last_name: string
          middle_name?: string | null
          photo_path?: string | null
          profile_id?: string | null
          program_id: string
          updated_at?: string
        }
        Update: {
          birthday?: string | null
          created_at?: string
          created_by?: string | null
          date_started?: string | null
          department_id?: string
          email?: string
          faculty_number?: string
          first_name?: string
          id?: string
          is_active?: boolean
          last_name?: string
          middle_name?: string | null
          photo_path?: string | null
          profile_id?: string | null
          program_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "faculty_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faculty_program_department_fkey"
            columns: ["program_id", "department_id"]
            isOneToOne: false
            referencedRelation: "program_overview"
            referencedColumns: ["id", "department_id"]
          },
          {
            foreignKeyName: "faculty_program_department_fkey"
            columns: ["program_id", "department_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id", "department_id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          dedupe_key: string | null
          id: string
          link: string | null
          message: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dedupe_key?: string | null
          id?: string
          link?: string | null
          message: string
          read_at?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dedupe_key?: string | null
          id?: string
          link?: string | null
          message?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          email: string
          first_name: string | null
          id: string
          is_active: boolean
          last_login_at: string | null
          last_name: string | null
          middle_name: string | null
          must_change_password: boolean
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          email: string
          first_name?: string | null
          id: string
          is_active?: boolean
          last_login_at?: string | null
          last_name?: string | null
          middle_name?: string | null
          must_change_password?: boolean
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          last_name?: string | null
          middle_name?: string | null
          must_change_password?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      programs: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          department_id: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          department_id: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          department_id?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "department_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "offering_overview"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "programs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "student_overview"
            referencedColumns: ["department_id"]
          },
        ]
      }
      question_categories: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          category_id: string
          content: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          is_required: boolean
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          category_id: string
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          is_required?: boolean
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          is_required?: boolean
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "category_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "question_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          first_name: string
          id: string
          is_active: boolean
          last_name: string
          middle_name: string | null
          profile_id: string | null
          program_id: string
          student_number: string
          updated_at: string
          year_level_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          first_name: string
          id?: string
          is_active?: boolean
          last_name: string
          middle_name?: string | null
          profile_id?: string | null
          program_id: string
          student_number: string
          updated_at?: string
          year_level_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          first_name?: string
          id?: string
          is_active?: boolean
          last_name?: string
          middle_name?: string | null
          profile_id?: string | null
          program_id?: string
          student_number?: string
          updated_at?: string
          year_level_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "program_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_year_level_id_fkey"
            columns: ["year_level_id"]
            isOneToOne: false
            referencedRelation: "year_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      subject_enrollments: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          offering_id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          offering_id: string
          student_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          offering_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subject_enrollments_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "offering_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_enrollments_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "subject_offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      subject_offerings: {
        Row: {
          academic_period_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          faculty_id: string
          id: string
          program_id: string
          section: string
          subject_id: string
          updated_at: string
        }
        Insert: {
          academic_period_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          faculty_id: string
          id?: string
          program_id: string
          section?: string
          subject_id: string
          updated_at?: string
        }
        Update: {
          academic_period_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          faculty_id?: string
          id?: string
          program_id?: string
          section?: string
          subject_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subject_offerings_academic_period_id_fkey"
            columns: ["academic_period_id"]
            isOneToOne: false
            referencedRelation: "academic_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_offerings_academic_period_id_fkey"
            columns: ["academic_period_id"]
            isOneToOne: false
            referencedRelation: "period_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_offerings_faculty_id_fkey"
            columns: ["faculty_id"]
            isOneToOne: false
            referencedRelation: "faculty"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_offerings_faculty_id_fkey"
            columns: ["faculty_id"]
            isOneToOne: false
            referencedRelation: "faculty_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_offerings_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "program_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_offerings_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_offerings_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          title: string
          units: number | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          title: string
          units?: number | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          title?: string
          units?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          description: string | null
          is_public: boolean
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          is_public?: boolean
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          is_public?: boolean
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      year_levels: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      activity_log_overview: {
        Row: {
          action: string | null
          created_at: string | null
          description: string | null
          entity_id: string | null
          entity_type: string | null
          id: number | null
          ip_address: string | null
          metadata: Json | null
          module: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          search_text: string | null
          user_agent: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action?: string | null
          created_at?: string | null
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: number | null
          ip_address?: string | null
          metadata?: Json | null
          module?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          search_text?: never
          user_agent?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string | null
          created_at?: string | null
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: number | null
          ip_address?: string | null
          metadata?: Json | null
          module?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          search_text?: never
          user_agent?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      category_overview: {
        Row: {
          active_question_count: number | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string | null
          is_active: boolean | null
          name: string | null
          question_count: number | null
          search_text: string | null
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          active_question_count?: never
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          question_count?: never
          search_text?: never
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          active_question_count?: never
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          question_count?: never
          search_text?: never
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      department_overview: {
        Row: {
          code: string | null
          created_at: string | null
          created_by: string | null
          id: string | null
          is_active: boolean | null
          name: string | null
          program_count: number | null
          search_text: string | null
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          program_count?: never
          search_text?: never
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          program_count?: never
          search_text?: never
          updated_at?: string | null
        }
        Relationships: []
      }
      enrollment_overview: {
        Row: {
          attempt_id: string | null
          average_rating: number | null
          created_at: string | null
          evaluation_status: string | null
          id: string | null
          offering_id: string | null
          program_code: string | null
          search_text: string | null
          sort_name: string | null
          started_at: string | null
          student_id: string | null
          student_is_active: boolean | null
          student_name: string | null
          student_number: string | null
          submitted_at: string | null
          year_level_name: string | null
          year_level_order: number | null
        }
        Relationships: [
          {
            foreignKeyName: "subject_enrollments_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "offering_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_enrollments_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "subject_offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      faculty_overview: {
        Row: {
          age: number | null
          birthday: string | null
          created_at: string | null
          created_by: string | null
          date_started: string | null
          department_code: string | null
          department_id: string | null
          department_name: string | null
          email: string | null
          faculty_number: string | null
          first_name: string | null
          full_name: string | null
          id: string | null
          is_active: boolean | null
          last_name: string | null
          middle_name: string | null
          photo_path: string | null
          profile_id: string | null
          program_code: string | null
          program_id: string | null
          program_name: string | null
          search_text: string | null
          sort_name: string | null
          updated_at: string | null
          years_of_service: number | null
        }
        Relationships: [
          {
            foreignKeyName: "faculty_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faculty_program_department_fkey"
            columns: ["program_id", "department_id"]
            isOneToOne: false
            referencedRelation: "program_overview"
            referencedColumns: ["id", "department_id"]
          },
          {
            foreignKeyName: "faculty_program_department_fkey"
            columns: ["program_id", "department_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id", "department_id"]
          },
        ]
      }
      offering_overview: {
        Row: {
          academic_period_id: string | null
          average_rating: number | null
          close_at: string | null
          completed_count: number | null
          created_at: string | null
          department_code: string | null
          department_id: string | null
          department_name: string | null
          enrolled_count: number | null
          faculty_email: string | null
          faculty_id: string | null
          faculty_name: string | null
          faculty_number: string | null
          faculty_photo_path: string | null
          id: string | null
          in_progress_count: number | null
          open_at: string | null
          period_label: string | null
          program_code: string | null
          program_id: string | null
          program_name: string | null
          progress_pct: number | null
          school_year: string | null
          search_text: string | null
          section: string | null
          semester: number | null
          start_year: number | null
          subject_code: string | null
          subject_id: string | null
          subject_title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subject_offerings_academic_period_id_fkey"
            columns: ["academic_period_id"]
            isOneToOne: false
            referencedRelation: "academic_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_offerings_academic_period_id_fkey"
            columns: ["academic_period_id"]
            isOneToOne: false
            referencedRelation: "period_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_offerings_faculty_id_fkey"
            columns: ["faculty_id"]
            isOneToOne: false
            referencedRelation: "faculty"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_offerings_faculty_id_fkey"
            columns: ["faculty_id"]
            isOneToOne: false
            referencedRelation: "faculty_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_offerings_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "program_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_offerings_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_offerings_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      period_overview: {
        Row: {
          close_at: string | null
          created_at: string | null
          created_by: string | null
          id: string | null
          is_current: boolean | null
          label: string | null
          open_at: string | null
          results_released_at: string | null
          school_year: string | null
          semester: number | null
          start_year: number | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          close_at?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string | null
          is_current?: boolean | null
          label?: string | null
          open_at?: string | null
          results_released_at?: string | null
          school_year?: string | null
          semester?: number | null
          start_year?: number | null
          status?: never
          updated_at?: string | null
        }
        Update: {
          close_at?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string | null
          is_current?: boolean | null
          label?: string | null
          open_at?: string | null
          results_released_at?: string | null
          school_year?: string | null
          semester?: number | null
          start_year?: number | null
          status?: never
          updated_at?: string | null
        }
        Relationships: []
      }
      program_overview: {
        Row: {
          code: string | null
          created_at: string | null
          created_by: string | null
          department_code: string | null
          department_id: string | null
          department_name: string | null
          id: string | null
          is_active: boolean | null
          name: string | null
          search_text: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "programs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "department_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "offering_overview"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "programs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "student_overview"
            referencedColumns: ["department_id"]
          },
        ]
      }
      question_overview: {
        Row: {
          category_id: string | null
          category_is_active: boolean | null
          category_name: string | null
          category_sort_order: number | null
          content: string | null
          created_at: string | null
          created_by: string | null
          id: string | null
          is_active: boolean | null
          is_required: boolean | null
          is_used: boolean | null
          search_text: string | null
          sort_order: number | null
          title: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "category_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "question_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      student_overview: {
        Row: {
          created_at: string | null
          created_by: string | null
          department_code: string | null
          department_id: string | null
          department_name: string | null
          email: string | null
          first_name: string | null
          full_name: string | null
          id: string | null
          is_active: boolean | null
          last_name: string | null
          middle_name: string | null
          profile_id: string | null
          program_code: string | null
          program_id: string | null
          program_name: string | null
          search_text: string | null
          sort_name: string | null
          student_number: string | null
          updated_at: string | null
          year_level_id: string | null
          year_level_name: string | null
          year_level_order: number | null
        }
        Relationships: [
          {
            foreignKeyName: "students_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "program_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_year_level_id_fkey"
            columns: ["year_level_id"]
            isOneToOne: false
            referencedRelation: "year_levels"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _require_admin: { Args: never; Returns: undefined }
      _save_evaluation: {
        Args: { p_answers: Json; p_comment: string; p_offering_id: string }
        Returns: string
      }
      admin_analytics: {
        Args: {
          p_department_id?: string
          p_faculty_id?: string
          p_period_id?: string
          p_program_id?: string
          p_semester?: number
          p_start_year?: number
          p_subject_id?: string
        }
        Returns: Json
      }
      admin_delete_offerings: { Args: { p_offering_ids: string[] }; Returns: Json }
      admin_delete_students: { Args: { p_student_ids: string[] }; Returns: Json }
      admin_import_course_rows: { Args: { p_rows: Json }; Returns: Json }
      admin_import_evaluation_rows: { Args: { p_rows: Json }; Returns: Json }
      admin_release_results: {
        Args: { p_period_id: string; p_release: boolean }
        Returns: undefined
      }
      admin_reset_evaluation: { Args: { p_attempt_id: string }; Returns: Json }
      admin_set_current_period: {
        Args: { p_period_id: string }
        Returns: undefined
      }
      complete_password_change: { Args: never; Returns: undefined }
      current_app_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      current_faculty_id: { Args: never; Returns: string }
      current_student_id: { Args: never; Returns: string }
      format_person_name: {
        Args: { p_first: string; p_last: string; p_middle: string }
        Returns: string
      }
      generate_scheduled_notifications: { Args: never; Returns: number }
      get_evaluation_form: { Args: { p_offering_id: string }; Returns: Json }
      get_faculty_analytics: {
        Args: { p_offering_id?: string; p_period_id?: string }
        Returns: Json
      }
      get_faculty_offerings: {
        Args: { p_period_id?: string }
        Returns: {
          average: number
          completed: number
          enrolled: number
          is_current: boolean
          meets_threshold: boolean
          offering_id: string
          period_id: string
          period_label: string
          program_code: string
          results_visible: boolean
          school_year: string
          section: string
          semester: number
          subject_code: string
          subject_title: string
        }[]
      }
      get_offering_results: { Args: { p_offering_id: string }; Returns: Json }
      get_setting: { Args: { p_key: string }; Returns: Json }
      get_student_evaluations: {
        Args: { p_period_id?: string }
        Returns: {
          close_at: string
          faculty_name: string
          faculty_photo_path: string
          offering_id: string
          open_at: string
          period_id: string
          period_label: string
          section: string
          started_at: string
          status: string
          subject_code: string
          subject_title: string
          submitted_at: string
        }[]
      }
      get_student_periods: {
        Args: never
        Returns: {
          id: string
          is_current: boolean
          label: string
          semester: number
          start_year: number
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      min_respondents: { Args: never; Returns: number }
      period_status: {
        Args: { p_close: string; p_open: string }
        Returns: string
      }
      results_visible: { Args: { p_period_id: string }; Returns: boolean }
      save_evaluation_progress: {
        Args: { p_answers: Json; p_comment?: string; p_offering_id: string }
        Returns: Json
      }
      submit_evaluation: {
        Args: { p_answers: Json; p_comment?: string; p_offering_id: string }
        Returns: Json
      }
      touch_last_login: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "faculty" | "student"
      evaluation_status: "in_progress" | "completed"
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
    Enums: {
      app_role: ["admin", "faculty", "student"],
      evaluation_status: ["in_progress", "completed"],
    },
  },
} as const
