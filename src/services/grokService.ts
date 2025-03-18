import { API_CONFIG } from '@/config/api';

interface GrokResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

export class GrokService {
  private static instance: GrokService;
  private controller: AbortController | null = null;

  private constructor() {}

  static getInstance(): GrokService {
    if (!GrokService.instance) {
      GrokService.instance = new GrokService();
    }
    return GrokService.instance;
  }

  async sendMessage(message: string): Promise<string> {
    try {
      // Якщо є активний запит, скасовуємо його
      if (this.controller) {
        this.controller.abort();
      }
      
      this.controller = new AbortController();

      const response = await fetch(API_CONFIG.GROK_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_CONFIG.GROK_API_KEY}`
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: message }],
          model: 'grok-1',
          temperature: 0.7
        }),
        signal: this.controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: GrokResponse = await response.json();
      this.controller = null;
      
      return data.choices[0].message.content;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Запит було скасовано');
        }
        throw new Error(`Помилка при спілкуванні з Grok AI: ${error.message}`);
      }
      throw error;
    }
  }

  cancelRequest() {
    if (this.controller) {
      this.controller.abort();
      this.controller = null;
    }
  }
} 