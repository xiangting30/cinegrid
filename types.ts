export interface GridItem {
  id: string;
  imageData: string | null; // Base64 string
  shotLabel: string;
  aspectRatio?: number; // width / height
  imageFit?: 'cover' | 'contain' | 'fill';
  colSpan?: number; // Deprecated but kept for type safety if needed during migration
  width?: number; // Percentage 1-100
}

export interface CropState {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Dimension {
  width: number;
  height: number;
}

export type GridColumns = 1 | 2 | 3 | 4;

export enum ShotPreset {
  ELS = "ELS (超远景)",
  LS = "LS (远景)",
  MLS = "MLS (中远景)",
  MS = "MS (中景)",
  MCU = "MCU (中近景)",
  CU = "CU (特写)",
  ECU = "ECU (极特写)",
  LOW_ANGLE = "Low Angle (低角度)",
  HIGH_ANGLE = "High Angle (高角度)"
}

export interface StyleSettings {
  gap: number;
  borderWidth: number;
  borderColor: string;
  fontSize: number;
  fontColor: string;
  aspectRatio: string; // e.g. "1/1", "4/5", "16/9"
}