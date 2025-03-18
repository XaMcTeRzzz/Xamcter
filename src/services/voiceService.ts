interface VoiceServiceOptions {
  onStart?: () => void;
  onResult?: (text: string) => void;
  onEnd?: () => void;
  onError?: (error: Error) => void;
  language?: string;
}

export class VoiceService {
  private static instance: VoiceService;
  private recognition: SpeechRecognition | null = null;
  private synthesis: SpeechSynthesis;
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private options: VoiceServiceOptions;

  private constructor(options: VoiceServiceOptions) {
    this.options = options;
    this.synthesis = window.speechSynthesis;
    this.initializeVoiceRecognition();
    this.initializeVoiceSynthesis();
  }

  static getInstance(options: VoiceServiceOptions = {}): VoiceService {
    if (!VoiceService.instance) {
      VoiceService.instance = new VoiceService(options);
    }
    return VoiceService.instance;
  }

  private initializeVoiceRecognition() {
    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        throw new Error('Розпізнавання мови не підтримується в цьому браузері');
      }

      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.lang = this.options.language || 'uk-UA';

      this.recognition.onstart = () => {
        this.options.onStart?.();
      };

      this.recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        this.options.onResult?.(text);
      };

      this.recognition.onend = () => {
        this.options.onEnd?.();
      };

      this.recognition.onerror = (event) => {
        this.options.onError?.(new Error(`Помилка розпізнавання: ${event.error}`));
      };
    } catch (error) {
      if (error instanceof Error) {
        this.options.onError?.(error);
      }
    }
  }

  private initializeVoiceSynthesis() {
    if (!this.synthesis) {
      this.options.onError?.(new Error('Синтез мови не підтримується в цьому браузері'));
      return;
    }

    // Очікуємо завантаження голосів
    if (this.synthesis.getVoices().length === 0) {
      this.synthesis.addEventListener('voiceschanged', () => {
        this.selectBestVoice();
      });
    } else {
      this.selectBestVoice();
    }
  }

  private selectBestVoice() {
    const voices = this.synthesis.getVoices();
    
    // Спочатку шукаємо український чоловічий голос
    this.selectedVoice = voices.find(voice => 
      voice.lang.includes('uk') && 
      (voice.name.toLowerCase().includes('male') || 
       voice.name.toLowerCase().includes('чоловік'))
    ) ||
    // Потім російський чоловічий
    voices.find(voice => 
      voice.lang.includes('ru') && 
      (voice.name.toLowerCase().includes('male') || 
       voice.name.toLowerCase().includes('мужской'))
    ) ||
    // Потім англійський з британським акцентом
    voices.find(voice => 
      voice.lang.includes('en-GB') && 
      (voice.name.toLowerCase().includes('male'))
    ) ||
    // В крайньому випадку - будь-який англійський
    voices.find(voice => 
      voice.lang.includes('en') && 
      (voice.name.toLowerCase().includes('male'))
    ) ||
    // Якщо нічого не знайдено - перший доступний голос
    voices[0];
  }

  startListening() {
    if (!this.recognition) {
      this.options.onError?.(new Error('Розпізнавання мови не ініціалізовано'));
      return;
    }

    try {
      this.recognition.start();
    } catch (error) {
      if (error instanceof Error) {
        this.options.onError?.(error);
      }
    }
  }

  stopListening() {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (error) {
        if (error instanceof Error) {
          this.options.onError?.(error);
        }
      }
    }
  }

  async speak(text: string): Promise<void> {
    if (!this.synthesis || !this.selectedVoice) {
      throw new Error('Синтез мови не доступний');
    }

    // Зупиняємо поточне мовлення
    this.synthesis.cancel();

    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = this.selectedVoice;
      utterance.rate = 1.0; // Швидкість мовлення
      utterance.pitch = 1.0; // Тон голосу
      utterance.volume = 1.0; // Гучність

      utterance.onend = () => resolve();
      utterance.onerror = (event) => reject(new Error(`Помилка синтезу мови: ${event.error}`));

      this.synthesis.speak(utterance);
    });
  }

  cancelSpeech() {
    if (this.synthesis) {
      this.synthesis.cancel();
    }
  }
} 