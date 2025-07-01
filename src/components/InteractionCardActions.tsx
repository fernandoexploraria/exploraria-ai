import React from 'react';
import { Interaction } from '@/types/interaction';

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
