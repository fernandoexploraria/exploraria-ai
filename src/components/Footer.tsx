import React from 'react';
import { Link } from 'react-router-dom';

const Footer: React.FC = () => {
  return (
    <footer className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <Link 
          to="/terms-of-use" 
          className="hover:text-foreground transition-colors underline"
        >
          Terms of Use
        </Link>
        <span>•</span>
        <Link 
          to="/account-privacy-policy" 
          className="hover:text-foreground transition-colors underline"
        >
          Privacy Policy
        </Link>
      </div>
    </footer>
  );
};

export default Footer;