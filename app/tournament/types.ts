export interface TournamentClip {
  url: string;
  pathname: string;
  key: string;
  category: string;
  slug: string;
  uploadedAt?: string;
  size?: number;
}

export type WizardStep = 1 | 2 | 3;
