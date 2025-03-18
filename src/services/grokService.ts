import { API_CONFIG } from '@/config/api';

interface GeminiResponse {
  candidates: [{
    content: {
      parts: [{
        text: string;
      }];
    };
  }];
}

export class GeminiService {
  private static instance: GeminiService;
  private controller: AbortController | null = null;

  private constructor() {}

  static getInstance(): GeminiService {
    if (!GeminiService.instance) {
      GeminiService.instance = new GeminiService();
    }
    return GeminiService.instance;
  }

  async sendMessage(message: string): Promise<string> {
    try {
      if (!API_CONFIG.GEMINI_API_KEY) {
        throw new Error('API ключ Gemini не налаштовано. Будь ласка, додайте ключ в конфігурацію.');
      }

      // Перевіряємо, чи це запит про погоду
      if (message.toLowerCase().includes('погода')) {
        return this.handleWeatherQuery(message);
      }

      // Якщо є активний запит, скасовуємо його
      if (this.controller) {
        this.controller.abort();
      }
      
      this.controller = new AbortController();

      console.log('Відправляємо запит до Gemini API:', {
        url: API_CONFIG.GEMINI_API_URL,
        message
      });

      const response = await fetch(`${API_CONFIG.GEMINI_API_URL}?key=${API_CONFIG.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Ти - Джарвіс, дружній AI-асистент. Відповідай коротко, чітко і професійно, як Джарвіс з "Залізної людини". Запит користувача: ${message}`
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 150,
            topP: 0.8,
            topK: 40
          }
        }),
        signal: this.controller.signal
      });

      console.log('Отримано відповідь від Gemini API:', {
        status: response.status,
        ok: response.ok
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error('Помилка відповіді Gemini API:', errorData);
        const errorMessage = errorData?.error?.message || `HTTP помилка! статус: ${response.status}`;
        throw new Error(`Помилка Gemini API: ${errorMessage}`);
      }

      const data: GeminiResponse = await response.json();
      console.log('Розпарсили відповідь від Gemini API:', {
        hasData: !!data,
        hasContent: !!data?.candidates?.[0]?.content?.parts?.[0]?.text
      });
      
      if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
        throw new Error('Некоректна відповідь від API');
      }

      this.controller = null;
      return data.candidates[0].content.parts[0].text;
      
    } catch (error) {
      console.error('Помилка при обробці запиту:', error);
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Запит було скасовано');
        }
        // Перевіряємо специфічні помилки API
        if (error.message.includes('API ключ')) {
          console.error('Помилка API ключа:', error);
          throw new Error('Будь ласка, налаштуйте API ключ Gemini в конфігурації');
        }
        if (error.message.includes('quota')) {
          throw new Error('Перевищено ліміт запитів до API. Спробуйте пізніше');
        }
        throw new Error(`Помилка при спілкуванні з AI: ${error.message}`);
      }
      throw error;
    } finally {
      this.controller = null;
    }
  }

  private async handleWeatherQuery(message: string): Promise<string> {
    try {
      console.log('Отримуємо дані про погоду з WeatherAPI');
      
      // Отримуємо погоду з WeatherAPI
      const weatherResponse = await fetch(`${API_CONFIG.WEATHER_API_URL}/current.json?key=${API_CONFIG.WEATHER_API_KEY}&q=Kyiv&lang=uk`);
      
      console.log('Отримано відповідь від WeatherAPI:', {
        status: weatherResponse.status,
        ok: weatherResponse.ok
      });

      if (!weatherResponse.ok) {
        console.error('Помилка отримання погоди, переключаємось на Gemini API');
        // Якщо не вдалося отримати погоду, відправляємо запит до Gemini
        const response = await fetch(`${API_CONFIG.GEMINI_API_URL}?key=${API_CONFIG.GEMINI_API_KEY}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Ти - Джарвіс. Вибачся, що не можеш надати точні дані про погоду через технічні обмеження, але запропонуй користувачу перевірити погоду на улюbленому погодному сервісі. Зроби це професійно, як Джарвіс з "Залізної людини".`
              }]
            }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 150,
              topP: 0.8,
              topK: 40
            }
          })
        });

        const data: GeminiResponse = await response.json();
        return data.candidates[0].content.parts[0].text;
      }

      const weatherData = await weatherResponse.json();
      console.log('Отримано дані про погоду:', weatherData);

      return `Сер, у Києві зараз ${weatherData.current.temp_c}°C, ${weatherData.current.condition.text.toLowerCase()}. Вітер ${weatherData.current.wind_kph} км/год. Чи потрібна вам додаткова інформація?`;
    } catch (error) {
      console.error('Помилка при отриманні погоди:', error);
      return "Вибачте, сер, але я не можу отримати точні дані про погоду через технічні обмеження. Рекомендую перевірити погоду на вашому улюбленому погодному сервісі.";
    }
  }

  cancelRequest() {
    if (this.controller) {
      this.controller.abort();
      this.controller = null;
    }
  }
} 