export type FacultyOffering = {
  offering_id: string; subject_code: string; subject_title: string; section: string; program_code: string;
  period_id: string; period_label: string; school_year: string; semester: number; is_current: boolean;
  enrolled: number; completed: number; results_visible: boolean; meets_threshold: boolean; average: number | null;
};

export type FacultyAnalytics = {
  min_respondents: number;
  progress: { offerings: number; enrolled: number; completed: number };
  released_offerings: number;
  respondents: number;
  overall_average: number | null;
  categories: { name: string; average: number; responses: number }[];
  distribution: { rating: number; count: number }[];
  comment_count: number;
  history: { label: string; start_year: number; semester: number; school_year: string; average: number; respondents: number }[];
};

export type OfferingResults = {
  offering: { id: string; subject_code: string; subject_title: string; section: string; period_label: string; school_year: string; semester: number; program_code: string; faculty_name: string };
  visible: boolean;
  reason?: "not_released" | "insufficient_respondents";
  respondents: number;
  enrolled: number;
  min_respondents: number;
  overall_average?: number | null;
  categories?: { name: string; average: number; responses: number }[];
  questions?: { category: string; title: string; content: string; average: number; responses: number }[];
  distribution?: { rating: number; count: number }[];
  comments?: string[];
};
