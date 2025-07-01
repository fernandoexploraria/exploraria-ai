
export interface Interaction {
  id: string;
  destination: string;
  user_input: string;
  assistant_response: string;
  interaction_type: string;
  created_at: string;
  landmark_coordinates: any;
  full_transcript: any;
  landmark_image_url: string | null;
  is_favorite: boolean;
  place_id?: string;
  conversation_id: string | null;
  conversation_duration: number | null;
  audio_url: string | null;
  agent_id: string | null;
  similarity?: number;
  conversation_summary?: string;
}
