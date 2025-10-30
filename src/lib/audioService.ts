class AudioService {
  private audioContext: AudioContext | null = null;
  private isEnabled = true;

  private initAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  playNotificationSound() {
    if (!this.isEnabled) return;

    try {
      this.initAudioContext();

      if (!this.audioContext) return;

      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);

      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + 0.5);

      setTimeout(() => {
        const osc2 = this.audioContext!.createOscillator();
        const gain2 = this.audioContext!.createGain();

        osc2.connect(gain2);
        gain2.connect(this.audioContext!.destination);

        osc2.frequency.value = 1000;
        osc2.type = 'sine';

        gain2.gain.setValueAtTime(0.3, this.audioContext!.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, this.audioContext!.currentTime + 0.5);

        osc2.start(this.audioContext!.currentTime);
        osc2.stop(this.audioContext!.currentTime + 0.5);
      }, 150);

    } catch (error) {
      console.error('Erro ao reproduzir som:', error);
    }
  }

  enable() {
    this.isEnabled = true;
  }

  disable() {
    this.isEnabled = false;
  }

  toggle() {
    this.isEnabled = !this.isEnabled;
    return this.isEnabled;
  }
}

export const audioService = new AudioService();
