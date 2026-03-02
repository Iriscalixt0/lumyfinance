export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
          onboarding_completed_at: string | null;
          onboarding_intent: "personal" | "family" | "business" | "other" | null;
          onboarding_intent_detail: string | null;
        };
        Insert: {
          id: string;
          full_name?: string;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
          onboarding_completed_at?: string | null;
          onboarding_intent?: "personal" | "family" | "business" | "other" | null;
          onboarding_intent_detail?: string | null;
        };
        Update: {
          id?: string;
          full_name?: string;
          avatar_url?: string | null;
          updated_at?: string;
          onboarding_completed_at?: string | null;
          onboarding_intent?: "personal" | "family" | "business" | "other" | null;
          onboarding_intent_detail?: string | null;
        };
      };
      profile_preferences: {
        Row: {
          user_id: string;
          location_consent: boolean;
          location_permission_state: "unknown" | "granted" | "denied";
          timezone: string | null;
          locale_hint: string | null;
          country_hint: string | null;
          region_hint: string | null;
          city_hint: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          location_consent?: boolean;
          location_permission_state?: "unknown" | "granted" | "denied";
          timezone?: string | null;
          locale_hint?: string | null;
          country_hint?: string | null;
          region_hint?: string | null;
          city_hint?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profile_preferences"]["Insert"]>;
      };
      workspaces: {
        Row: {
          id: string;
          name: string;
          slug: string;
          plan: "pro";
          owner_id: string;
          created_at: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          plan_updated_at: string | null;
          beta_program_id: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          plan?: "pro";
          owner_id: string;
          created_at?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          plan_updated_at?: string | null;
          beta_program_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["workspaces"]["Insert"]>;
      };
      workspace_members: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          role: "owner" | "admin" | "editor" | "viewer";
          granted_role: "owner" | "admin" | "editor" | "viewer" | null;
          invited_by: string | null;
          accepted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          role?: "owner" | "admin" | "editor" | "viewer";
          granted_role?: "owner" | "admin" | "editor" | "viewer" | null;
          invited_by?: string | null;
          accepted_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["workspace_members"]["Insert"]>;
      };
      workspace_invites: {
        Row: {
          id: string;
          workspace_id: string;
          email: string;
          role: "admin" | "editor" | "viewer";
          token: string;
          invited_by: string;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          email: string;
          role?: "admin" | "editor" | "viewer";
          token: string;
          invited_by: string;
          expires_at: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["workspace_invites"]["Insert"]>;
      };
      categories: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          icon: string;
          type: "income" | "expense";
          color: string;
          is_system: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          name: string;
          icon?: string;
          type: "income" | "expense";
          color?: string;
          is_system?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["categories"]["Insert"]>;
      };
      transactions: {
        Row: {
          id: string;
          workspace_id: string;
          account_id: string | null;
          category_id: string | null;
          type: "income" | "expense" | "transfer";
          amount: number;
          description: string;
          date: string;
          tags: string[];
          notes: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          account_id?: string | null;
          category_id?: string | null;
          type: "income" | "expense" | "transfer";
          amount: number;
          description: string;
          date: string;
          tags?: string[];
          notes?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["transactions"]["Insert"]>;
      };
      investments: {
        Row: {
          id: string;
          workspace_id: string;
          account_id: string | null;
          name: string;
          type: string | null;
          amount: number;
          current_value: number | null;
          date: string;
          notes: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          account_id?: string | null;
          name: string;
          type?: string | null;
          amount: number;
          current_value?: number | null;
          date: string;
          notes?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["investments"]["Insert"]>;
      };
      goals: {
        Row: {
          id: string;
          workspace_id: string;
          title: string;
          target_amount: number;
          deadline: string | null;
          icon: string;
          color: string;
          status: "active" | "completed" | "archived";
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          title: string;
          target_amount: number;
          deadline?: string | null;
          icon?: string;
          color?: string;
          status?: "active" | "completed" | "archived";
          created_by: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["goals"]["Insert"]>;
      };
      goal_contributions: {
        Row: {
          id: string;
          goal_id: string;
          workspace_id: string;
          amount: number;
          date: string;
          notes: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          goal_id: string;
          workspace_id: string;
          amount: number;
          date: string;
          notes?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["goal_contributions"]["Insert"]>;
      };
      receivables: {
        Row: {
          id: string;
          workspace_id: string;
          debtor_name: string;
          amount: number;
          due_date: string | null;
          status: "pending" | "paid" | "overdue";
          phone: string | null;
          notes: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          debtor_name: string;
          amount: number;
          due_date?: string | null;
          status?: "pending" | "paid" | "overdue";
          phone?: string | null;
          notes?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["receivables"]["Insert"]>;
      };
      support_requests: {
        Row: {
          id: string;
          user_id: string;
          workspace_id: string | null;
          email: string;
          subject: string;
          category: string;
          message: string;
          priority: "low" | "medium" | "high" | "urgent";
          status: "pending" | "sent" | "failed";
          sent_at: string | null;
          send_error: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          workspace_id?: string | null;
          email: string;
          subject: string;
          category: string;
          message: string;
          priority?: "low" | "medium" | "high" | "urgent";
          status?: "pending" | "sent" | "failed";
          sent_at?: string | null;
          send_error?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["support_requests"]["Insert"]>;
      };
      beta_programs: {
        Row: {
          id: string;
          name: string;
          token: string;
          created_by: string;
          starts_at: string;
          ends_at: string;
          max_participants: number;
          status: "active" | "ended" | "blocked";
          created_at: string;
          ended_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          token: string;
          created_by: string;
          starts_at?: string;
          ends_at: string;
          max_participants?: number;
          status?: "active" | "ended" | "blocked";
          created_at?: string;
          ended_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["beta_programs"]["Insert"]>;
      };
      beta_participants: {
        Row: {
          id: string;
          beta_program_id: string;
          user_id: string;
          workspace_id: string;
          joined_at: string;
          status: "active" | "upgraded" | "feedback_pending" | "feedback_given" | "blocked";
          blocked_at: string | null;
          data_delete_after: string | null;
          feedback_text: string | null;
          feedback_upgraded: boolean | null;
          feedback_at: string | null;
          upgraded_at: string | null;
        };
        Insert: {
          id?: string;
          beta_program_id: string;
          user_id: string;
          workspace_id: string;
          joined_at?: string;
          status?: "active" | "upgraded" | "feedback_pending" | "feedback_given" | "blocked";
          blocked_at?: string | null;
          data_delete_after?: string | null;
          feedback_text?: string | null;
          feedback_upgraded?: boolean | null;
          feedback_at?: string | null;
          upgraded_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["beta_participants"]["Insert"]>;
      };
      beta_contact_preferences: {
        Row: {
          user_id: string;
          whatsapp_e164: string | null;
          marketing_email_opt_in: boolean;
          marketing_whatsapp_opt_in: boolean;
          captured_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          whatsapp_e164?: string | null;
          marketing_email_opt_in?: boolean;
          marketing_whatsapp_opt_in?: boolean;
          captured_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["beta_contact_preferences"]["Insert"]>;
      };
      beta_conversion_campaign_events: {
        Row: {
          id: string;
          beta_program_id: string;
          user_id: string;
          channel: "in_app" | "email" | "whatsapp";
          stage: "d0" | "d2" | "d7" | "d9";
          status: "queued" | "sent" | "failed" | "skipped";
          provider_message_id: string | null;
          error: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          beta_program_id: string;
          user_id: string;
          channel: "in_app" | "email" | "whatsapp";
          stage: "d0" | "d2" | "d7" | "d9";
          status: "queued" | "sent" | "failed" | "skipped";
          provider_message_id?: string | null;
          error?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["beta_conversion_campaign_events"]["Insert"]>;
      };
      billing_portal_feedbacks: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          reason: string | null;
          comment: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          reason?: string | null;
          comment?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["billing_portal_feedbacks"]["Insert"]>;
      };
    };
  };
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Workspace = Database["public"]["Tables"]["workspaces"]["Row"];
export type WorkspaceInvite = Database["public"]["Tables"]["workspace_invites"]["Row"];
export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
export type Investment = Database["public"]["Tables"]["investments"]["Row"];
export type Goal = Database["public"]["Tables"]["goals"]["Row"];
export type GoalContribution = Database["public"]["Tables"]["goal_contributions"]["Row"];
export type Receivable = Database["public"]["Tables"]["receivables"]["Row"];
export type ProfilePreferences = Database["public"]["Tables"]["profile_preferences"]["Row"];
export type SupportRequest = Database["public"]["Tables"]["support_requests"]["Row"];
export type BetaContactPreferences = Database["public"]["Tables"]["beta_contact_preferences"]["Row"];
export type BetaCampaignStage = Database["public"]["Tables"]["beta_conversion_campaign_events"]["Row"]["stage"];
export type BetaCampaignEvent = Database["public"]["Tables"]["beta_conversion_campaign_events"]["Row"];

