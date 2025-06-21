
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import VoiceSearchDialog from './VoiceSearchDialog';

const SearchButton: React.FC = () => {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setSearchOpen(true)}
        className="gap-2"
      >
        <Search className="w-4 h-4" />
        Travel Log
      </Button>
      
      <VoiceSearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
      />
    </>
  );
};

export default SearchButton;
