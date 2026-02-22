export interface Token {
  id: number;
  auth_type: 'Social' | 'IdC';
  refresh_token: string;
  client_id?: string;
  client_secret?: string;
  description?: string;
  disabled: number;
  usage_count: number;
  last_used?: string;
  created_at: string;
  updated_at: string;
  // 统计信息
  status?: string;
  total_requests?: number;
  total_tokens_used?: number;
  total_input_tokens?: number;
  total_output_tokens?: number;
  last_request_time?: string;
  // 有效性信息
  validity?: {
    valid: boolean | null;
    message: string;
    checking?: boolean;
    reason?: string;
    usageDetails?: {
      totalLimit: number;
      totalUsed: number;
      available: number;
      baseLimit: number;
      baseUsed: number;
      freeTrialLimit: number;
      freeTrialUsed: number;
      freeTrialStatus: string;
      userEmail?: string;
    };
  };
}

export interface ApiKey {
  id: number;
  key_name: string;
  key_value: string;
  description?: string;
  disabled: number;
  created_at: string;
}

export interface SystemConfig {
  id: number;
  config_key: string;
  config_value: string;
  description?: string;
  updated_at: string;
}

export interface UsageLog {
  id: number;
  token_id?: number;
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  request_time: string;
  response_time: number;
  status: string;
  error_message?: string;
}

export interface UsageStats {
  date: string;
  request_count: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  avg_response_time: number;
}

export interface DashboardData {
  totalTokens: number;
  totalApiKeys: number;
  todayRequests: number;
  todayTokens: number;
  recentLogs: UsageLog[];
}

export interface User {
  id: number;
  username: string;
  role: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}
