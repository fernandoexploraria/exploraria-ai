
import React from 'react';

interface Interaction {
  id: string;
  destination: string;
  user_input: string;
  assistant_response: string;
  interaction_type: string;
  landmark_coordinates: any;
  full_transcript: any;
  created_at: string;
  is_favorite: boolean; // Added to match main interface
}

interface InteractionCardActionsProps {
  interaction: Interaction;
}

const InteractionCardActions: React.FC<InteractionCardActionsProps> = ({
  interaction,
}) => {
  return (
    <div className="mt-2 flex-shrink-0">
      {/* Actions area - can be used for other buttons in the future */}
    </div>
  );
};

export default InteractionCardActions;
