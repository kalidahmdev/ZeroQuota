/**
 * ZeroQuota - Antigravity IDE Extension
 * Copyright (c) 2026 kalidahmdev
 * Licensed under the MIT License
 */

export interface QuotaInfo {
  remainingFraction: number;
  resetTime?: string;
}

export interface ModelConfig {
  label: string;
  quotaInfo?: QuotaInfo;
}

export interface UserStatus {
  name?: string;
  email: string;
  tier: string;
  profilePictureUrl?: string;
  modelConfigs: ModelConfig[];
  activeModel?: string;
  activeModelLabel?: string;
  promptCredits: number;
  availablePromptCredits: number;
  flowCredits: number;
  availableFlowCredits: number;
}

export interface TrajectoryInfo {
  summary: string;
  stepCount: number;
  lastModifiedTime?: string;
}

export interface ModelPickerConfig {
  geminiPro?: boolean;
  geminiFlash?: boolean;
  claude?: boolean;
  gptOss?: boolean;
}
