import { VoiceDemoAudioGenerator } from '@/components/VoiceDemoAudioGenerator';

const AudioGenerator = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-4xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Voice Demo Setup</h1>
          <p className="text-muted-foreground">
            Generate all the audio files needed for your pre-rendered voice demo
          </p>
        </div>
        
        <VoiceDemoAudioGenerator />
        
        <div className="text-center">
          <a 
            href="/" 
            className="text-primary hover:text-primary/80 underline"
          >
            ← Back to App
          </a>
        </div>
      </div>
    </div>
  );
};

export default AudioGenerator;