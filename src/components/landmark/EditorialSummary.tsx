
import React, { useState } from 'react';
import { formatEditorialSummary } from '@/utils/landmarkDisplayUtils';

interface EditorialSummaryProps {
  summary: string;
  maxLength?: number;
  className?: string;
}

const EditorialSummary: React.FC<EditorialSummaryProps> = ({
  summary,
  maxLength = 60,
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!summary) return null;

  const needsTruncation = summary.length > maxLength;
  const displayText = needsTruncation && !isExpanded 
    ? formatEditorialSummary(summary, maxLength)
    : summary;

  return (
    <div className={`text-sm text-gray-300 ${className}`}>
      <p>{displayText}</p>
      {needsTruncation && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-blue-400 hover:text-blue-300 text-xs mt-1"
        >
          {isExpanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  );
};

export default EditorialSummary;
