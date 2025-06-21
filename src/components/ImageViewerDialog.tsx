
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';

interface ImageViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
  imageName: string;
}

const ImageViewerDialog: React.FC<ImageViewerDialogProps> = ({
  open,
  onOpenChange,
  imageUrl,
  imageName,
}) => {
  const handleDownload = async () => {
    try {
      // Create a temporary link element for download
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = `${imageName.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`;
      link.target = '_blank';
      
      // For mobile devices, open in new tab so users can long-press and save
      if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        window.open(imageUrl, '_blank');
      } else {
        // For desktop, try direct download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error('Error downloading image:', error);
      // Fallback: open image in new tab
      window.open(imageUrl, '_blank');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center justify-between">
            <span>{imageName}</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="p-6 pt-2">
          <img 
            src={imageUrl} 
            alt={imageName}
            className="w-full h-auto max-h-[70vh] object-contain rounded-lg"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImageViewerDialog;
