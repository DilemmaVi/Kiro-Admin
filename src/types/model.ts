export interface Model {
  id: number;
  model_name: string;
  internal_model_id: string;
  description?: string;
  provider: string;
  disabled: number;
  display_order: number;
  created_at: string;
  updated_at: string;
}