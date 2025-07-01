
import React from 'react';

interface EditorialSummaryProps {
  summary: string;
  className?: string;
}

const EditorialSummary: React.FC<EditorialSummaryProps> = ({ 
  summary, 
  className = "" 
}) => {
  return (
    <p className={`text-sm text-gray-600 ${className}`}>
      {summary}
    </p>
  );
};

export default EditorialSummary;
