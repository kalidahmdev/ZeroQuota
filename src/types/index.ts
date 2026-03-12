export interface QuotaInfo {
  remainingFraction: number;
  resetTime?: string;
}

export interface ModelConfig {
  label: string;
  quotaInfo?: QuotaInfo;
}

export interface UserStatus {
  email: string;
  tier: string;
  modelConfigs: ModelConfig[];
  promptCredits: number;
  availablePromptCredits: number;
  flowCredits: number;
  availableFlowCredits: number;
}
