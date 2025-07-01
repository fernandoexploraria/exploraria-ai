
import React from 'react';

interface OpeningStatusProps {
  status: string;
}

const OpeningStatus: React.FC<OpeningStatusProps> = ({ status }) => {
  const isOpen = status === 'Open Now';
  
  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
        isOpen
          ? 'bg-green-100 text-green-800'
          : 'bg-red-100 text-red-800'
      }`}
    >
      {status}
    </span>
  );
};

export default OpeningStatus;
