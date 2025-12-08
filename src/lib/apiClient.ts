// HTTP API Client for direct communication with Python backend
// Used in development mode to bypass Edge Functions

import { API_CONFIG, getApiUrl } from '@/config/api';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ApiError {
  message: string;
  status?: number;
  details?: string;
}

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_CONFIG.LOCAL_API_URL;
  }

  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorJson.message || errorMessage;
      } catch {
        if (errorText) errorMessage = errorText;
      }

      throw new Error(errorMessage);
    }

    const data = await response.json();
    return { success: true, data };
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    const url = getApiUrl(endpoint);
    console.log(`[API Client] GET ${url}`);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
      return this.handleResponse<T>(response);
    } catch (error) {
      console.error(`[API Client] GET ${url} failed:`, error);
      throw this.formatError(error);
    }
  }

  async post<T>(endpoint: string, body?: FormData | object): Promise<ApiResponse<T>> {
    const url = getApiUrl(endpoint);
    console.log(`[API Client] POST ${url}`);

    try {
      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };

      let requestBody: FormData | string | undefined;

      if (body instanceof FormData) {
        requestBody = body;
        // Don't set Content-Type for FormData - browser will set it with boundary
      } else if (body) {
        headers['Content-Type'] = 'application/json';
        requestBody = JSON.stringify(body);
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: requestBody,
      });

      return this.handleResponse<T>(response);
    } catch (error) {
      console.error(`[API Client] POST ${url} failed:`, error);
      throw this.formatError(error);
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await this.get(API_CONFIG.ENDPOINTS.HEALTH);
      return response.success;
    } catch {
      return false;
    }
  }

  private formatError(error: unknown): ApiError {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return {
        message: 'Cannot connect to Python API. Make sure the Flask server is running on localhost:5000',
        details: 'Run: cd PyImageSearch && python app.py',
      };
    }

    if (error instanceof Error) {
      return {
        message: error.message,
      };
    }

    return {
      message: 'An unexpected error occurred',
    };
  }
}

export const apiClient = new ApiClient();
