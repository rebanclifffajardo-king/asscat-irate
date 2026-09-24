export type EvaluationQuestion = { id: string; title: string; content: string; is_required: boolean };
export type EvaluationCategory = { id: string | null; name: string; description: string | null; questions: EvaluationQuestion[] };

export type EvaluationForm = {
  offering: { id: string; subject_code: string; subject_title: string; section: string; program_code: string; program_name: string };
  faculty: { name: string; photo_path: string | null; department_name: string };
  period: { id: string; label: string; school_year: string; semester: number; open_at: string; close_at: string; status: "upcoming" | "active" | "closed" };
  scale: { value: number; label: string }[];
  allow_comments: boolean;
  require_comments: boolean;
  attempt: { status: "in_progress" | "completed"; started_at: string; submitted_at: string | null; updated_at: string } | null;
  comment: string | null;
  answers: Record<string, number>;
  categories: EvaluationCategory[];
};
