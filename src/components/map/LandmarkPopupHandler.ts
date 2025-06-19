
import mapboxgl from 'mapbox-gl';
import { Landmark } from '@/data/landmarks';

export class LandmarkPopupHandler {
  private photoPopups: { [key: string]: mapboxgl.Popup } = {};
  private playingAudio: { [key: string]: boolean } = {};
  private map: mapboxgl.Map | null = null;
  private fetchImage: (landmark: Landmark) => Promise<string>;
  private allLandmarks: Landmark[] = [];
  private isSpeaking: boolean = false;

  constructor(
    map: mapboxgl.Map | null,
    fetchImage: (landmark: Landmark) => Promise<string>,
    allLandmarks: Landmark[],
    isSpeaking: boolean
  ) {
    this.map = map;
    this.fetchImage = fetchImage;
    this.allLandmarks = allLandmarks;
    this.isSpeaking = isSpeaking;
  }

  updateState(playingAudio: { [key: string]: boolean }, isSpeaking: boolean) {
    this.playingAudio = playingAudio;
    this.isSpeaking = isSpeaking;
  }

  showLandmarkPopup = async (landmark: Landmark) => {
    if (!this.map) return;
    
    console.log('Showing popup for:', landmark.name);
    
    // Remove existing photo popup for this landmark
    if (this.photoPopups[landmark.id]) {
      this.photoPopups[landmark.id].remove();
    }
    
    // Close all other popups first
    Object.values(this.photoPopups).forEach(popup => {
      popup.remove();
    });
    this.photoPopups = {};
    
    // Create new photo popup with image and listen button
    const photoPopup = new mapboxgl.Popup({
      closeButton: true,
      closeOnClick: false,
      offset: 25,
      maxWidth: '450px',
      className: 'custom-popup'
    });

    // Initial popup with loading state
    photoPopup
      .setLngLat(landmark.coordinates)
      .setHTML(this.getLoadingPopupHTML(landmark.name))
      .addTo(this.map!);

    this.photoPopups[landmark.id] = photoPopup;

    // Handle popup close event
    photoPopup.on('close', () => {
      delete this.photoPopups[landmark.id];
    });

    // Fetch and display image with listen button
    try {
      const imageUrl = await this.fetchImage(landmark);
      const isPlaying = this.playingAudio[landmark.id] || this.isSpeaking;
      
      photoPopup.setHTML(this.getImagePopupHTML(landmark, imageUrl, isPlaying));

      // Add global handler for listen button if it doesn't exist
      if (!(window as any).handleLandmarkListen) {
        (window as any).handleLandmarkListen = (landmarkId: string) => {
          const targetLandmark = this.allLandmarks.find(l => l.id === landmarkId);
          if (targetLandmark && (window as any).handleLandmarkTextToSpeech) {
            (window as any).handleLandmarkTextToSpeech(targetLandmark);
          }
        };
      }

    } catch (error) {
      console.error('Failed to load image for', landmark.name, error);
      photoPopup.setHTML(this.getNoImagePopupHTML(landmark));
    }
  };

  private getLoadingPopupHTML(landmarkName: string): string {
    return `
      <div style="text-align: center; padding: 10px; position: relative;">
        ${this.getCloseButtonHTML()}
        <h3 style="margin: 0 0 10px 0; font-size: 16px; font-weight: bold; padding-right: 30px; color: #1a1a1a;">${landmarkName}</h3>
        <div style="margin-bottom: 10px; color: #666;">Loading image...</div>
      </div>
    `;
  }

  private getImagePopupHTML(landmark: Landmark, imageUrl: string, isPlaying: boolean): string {
    return `
      <div style="text-align: center; padding: 10px; max-width: 400px; position: relative;">
        ${this.getCloseButtonHTML()}
        <h3 style="margin: 0 0 10px 0; font-size: 16px; font-weight: bold; padding-right: 30px; color: #1a1a1a;">${landmark.name}</h3>
        <div style="position: relative; margin-bottom: 10px;">
          <img src="${imageUrl}" alt="${landmark.name}" style="width: 100%; height: 150px; object-fit: cover; border-radius: 8px;" />
          ${this.getListenButtonHTML(landmark.id, isPlaying)}
        </div>
      </div>
    `;
  }

  private getNoImagePopupHTML(landmark: Landmark): string {
    return `
      <div style="text-align: center; padding: 10px; max-width: 400px; position: relative;">
        ${this.getCloseButtonHTML()}
        <h3 style="margin: 0 0 10px 0; font-size: 16px; font-weight: bold; padding-right: 30px; color: #1a1a1a;">${landmark.name}</h3>
        <div style="width: 100%; height: 150px; background-color: #f0f0f0; border-radius: 8px; margin-bottom: 10px; display: flex; align-items: center; justify-content: center; color: #888; position: relative;">
          No image available
          ${this.getListenButtonHTML(landmark.id, false)}
        </div>
      </div>
    `;
  }

  private getCloseButtonHTML(): string {
    return `
      <button class="custom-close-btn" onclick="this.closest('.mapboxgl-popup').remove()" style="
        position: absolute;
        top: 5px;
        right: 5px;
        background: rgba(0, 0, 0, 0.7);
        color: white;
        border: none;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: bold;
        z-index: 1000;
        transition: background-color 0.2s;
      " onmouseover="this.style.backgroundColor='rgba(0, 0, 0, 0.9)'" onmouseout="this.style.backgroundColor='rgba(0, 0, 0, 0.7)'">×</button>
    `;
  }

  private getListenButtonHTML(landmarkId: string, isPlaying: boolean): string {
    return `
      <button 
        class="listen-btn-${landmarkId}" 
        onclick="window.handleLandmarkListen('${landmarkId}')"
        style="
          position: absolute;
          bottom: 10px;
          right: 10px;
          background: rgba(0, 0, 0, 0.9);
          color: white;
          border: 3px solid rgba(255, 255, 255, 0.9);
          border-radius: 50%;
          width: 56px;
          height: 56px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          transition: all 0.3s ease;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
          ${isPlaying ? 'opacity: 0.7;' : ''}
        "
        onmouseover="this.style.backgroundColor='rgba(59, 130, 246, 0.95)'; this.style.borderColor='white'; this.style.transform='scale(1.15)'; this.style.boxShadow='0 6px 20px rgba(0, 0, 0, 0.5)'"
        onmouseout="this.style.backgroundColor='rgba(0, 0, 0, 0.9)'; this.style.borderColor='rgba(255, 255, 255, 0.9)'; this.style.transform='scale(1)'; this.style.boxShadow='0 4px 12px rgba(0, 0, 0, 0.4)'"
        ${isPlaying ? 'disabled' : ''}
        title="Listen to description"
      >
        🔊
      </button>
    `;
  }

  closeAllPopups() {
    Object.values(this.photoPopups).forEach(popup => {
      popup.remove();
    });
    this.photoPopups = {};
  }
}
