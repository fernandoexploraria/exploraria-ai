
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Instagram, Camera, MapPin, Loader2, Unlink, AlertCircle } from 'lucide-react';
import { useInstagram } from '@/hooks/useInstagram';

interface InstagramIntegrationProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onPostSelect?: (post: any) => void;
}

const InstagramIntegration: React.FC<InstagramIntegrationProps> = ({
  isOpen,
  onOpenChange,
  onPostSelect
}) => {
  const {
    isConnected,
    user,
    posts,
    isLoading,
    connectInstagram,
    disconnect,
    refreshPosts
  } = useInstagram();

  const handlePostClick = (post: any) => {
    if (onPostSelect) {
      onPostSelect(post);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Instagram className="h-5 w-5" />
            Instagram Travel Memories
          </DialogTitle>
        </DialogHeader>

        {!isConnected ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Instagram className="h-16 w-16 text-pink-500" />
            <h3 className="text-xl font-semibold">Connect Your Instagram Business Account</h3>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 max-w-md">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <span className="font-medium text-amber-800">Business Account Required</span>
              </div>
              <p className="text-sm text-amber-700">
                Instagram now requires a Business or Creator account to access posts through their API. 
                Please convert your personal account to a Business account in your Instagram settings.
              </p>
            </div>
            <p className="text-muted-foreground text-center max-w-md">
              Connect your Instagram Business account to see your travel photos on the map and create a visual timeline of your adventures.
            </p>
            <Button 
              onClick={connectInstagram}
              disabled={isLoading}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Instagram className="mr-2 h-4 w-4" />
              )}
              Connect Instagram Business Account
            </Button>
          </div>
        ) : (
          <div className="flex flex-col space-y-4">
            {/* User Info */}
            {user && (
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                    <Instagram className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold">@{user.username}</p>
                    <p className="text-sm text-muted-foreground">
                      {user.media_count} posts • {user.account_type}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={refreshPosts}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Refresh'
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={disconnect}
                  >
                    <Unlink className="mr-2 h-4 w-4" />
                    Disconnect
                  </Button>
                </div>
              </div>
            )}

            {/* Posts Grid */}
            <div className="flex-1 overflow-y-auto">
              {posts.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
                  {posts.map((post) => (
                    <div
                      key={post.id}
                      className="relative aspect-square cursor-pointer group"
                      onClick={() => handlePostClick(post)}
                    >
                      <img
                        src={post.media_url}
                        alt={post.caption || 'Instagram post'}
                        className="w-full h-full object-cover rounded-lg transition-all group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded-lg" />
                      
                      {/* Post Type Badge */}
                      <Badge 
                        variant="secondary" 
                        className="absolute top-2 left-2 opacity-80"
                      >
                        {post.media_type === 'VIDEO' ? (
                          <Camera className="h-3 w-3 mr-1" />
                        ) : post.media_type === 'CAROUSEL_ALBUM' ? (
                          <span className="text-xs">📷</span>
                        ) : (
                          <Camera className="h-3 w-3 mr-1" />
                        )}
                        {post.media_type}
                      </Badge>

                      {/* Location Badge (if available) */}
                      {post.location && (
                        <Badge 
                          variant="secondary" 
                          className="absolute bottom-2 right-2 opacity-80"
                        >
                          <MapPin className="h-3 w-3 mr-1" />
                          {post.location.name}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <Camera className="h-12 w-12 text-muted-foreground" />
                  <p className="text-muted-foreground">No posts found</p>
                  <Button onClick={refreshPosts} variant="outline">
                    Refresh Posts
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default InstagramIntegration;
