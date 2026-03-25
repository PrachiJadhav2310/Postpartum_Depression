// API Service for Backend Communication
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

// Debug: Log API base URL (remove in production)
if (import.meta.env.DEV) {
  console.log('🔗 API Base URL:', API_BASE_URL);
}

// Token storage utilities
const TOKEN_KEY = 'auth_access_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';

export const getAccessToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

export const getRefreshToken = (): string | null => {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
};

export const setTokens = (accessToken: string, refreshToken: string): void => {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
};

export const clearTokens = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
};

// API request helper
const apiRequest = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<any> => {
  const token = getAccessToken();
  const url = `${API_BASE_URL}${endpoint}`;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    // Debug: Log request details in development
    if (import.meta.env.DEV) {
      console.log('📤 API Request:', {
        method: options.method || 'GET',
        url,
        hasToken: !!token
      });
    }
    
    const response = await fetch(url, {
      ...options,
      headers,
    });
    
    // Debug: Log response details in development
    if (import.meta.env.DEV) {
      console.log('📥 API Response:', {
        status: response.status,
        statusText: response.statusText,
        url: response.url
      });
    }

    // Check if response is ok before trying to parse JSON
    let data;
    try {
      const text = await response.text();
      data = text ? JSON.parse(text) : {};
    } catch (parseError) {
      // If JSON parsing fails, create error response
      if (!response.ok) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }
      throw new Error('Invalid response from server');
    }

    // If token expired, try to refresh
    if (response.status === 401 && token) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        // Retry the original request with new token
        const newToken = getAccessToken();
        headers['Authorization'] = `Bearer ${newToken}`;
        const retryResponse = await fetch(url, {
          ...options,
          headers,
        });
        const retryText = await retryResponse.text();
        return retryText ? JSON.parse(retryText) : {};
      } else {
        // Refresh failed, clear tokens
        clearTokens();
        throw new Error('Session expired. Please log in again.');
      }
    }

    if (!response.ok) {
      throw new Error(data.message || data.error || `Request failed: ${response.status} ${response.statusText}`);
    }

    return data;
  } catch (error: any) {
    console.error('API request error:', error);
    
    // Handle network errors specifically
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Network error: Cannot connect to server. Please check if the backend server is running on http://localhost:5000');
    }
    
    // Handle connection refused
    if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
      throw new Error('Cannot connect to server. Please ensure the backend server is running on http://localhost:5000');
    }
    
    // Re-throw with original message if it's already a user-friendly error
    throw error;
  }
};

// Refresh access token
const refreshAccessToken = async (): Promise<boolean> => {
  try {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;

    // Avoid hitting the backend refresh endpoint with an already-expired token.
    // This prevents noisy "jwt expired" server logs and keeps UX stable.
    const isJwtExpired = (token: string): boolean => {
      try {
        const parts = token.split('.');
        if (parts.length !== 3) return false;
        const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const payloadJson = atob(payloadBase64);
        const payload = JSON.parse(payloadJson);
        if (!payload?.exp) return false;
        return payload.exp * 1000 <= Date.now();
      } catch {
        return false;
      }
    };

    if (isJwtExpired(refreshToken)) {
      clearTokens();
      return false;
    }

    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    const data = await response.json();

    if (data.success && data.data?.tokens) {
      setTokens(data.data.tokens.accessToken, data.data.tokens.refreshToken);
      return true;
    }

    return false;
  } catch (error) {
    console.error('Token refresh error:', error);
    return false;
  }
};

// Auth API
export const authAPI = {
  register: async (data: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
    dueDate?: string;
    birthDate?: string;
  }) => {
    const response = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    
    if (response.success && response.data.tokens) {
      setTokens(response.data.tokens.accessToken, response.data.tokens.refreshToken);
    }
    
    return response;
  },

  login: async (email: string, password: string) => {
    const response = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    if (response.success && response.data.tokens) {
      setTokens(response.data.tokens.accessToken, response.data.tokens.refreshToken);
    }
    
    return response;
  },

  logout: async () => {
    try {
      await apiRequest('/auth/logout', {
        method: 'POST',
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      clearTokens();
    }
  },

  getCurrentUser: async () => {
    return apiRequest('/auth/me');
  },
};

// Health API
export const healthAPI = {
  addRecord: async (record: {
    recordType: string;
    value: number;
    unit: string;
    notes?: string;
    recordedAt?: string;
  }) => {
    return apiRequest('/health/records', {
      method: 'POST',
      body: JSON.stringify(record),
    });
  },

  getRecords: async (params?: {
    type?: string;
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, String(value));
        }
      });
    }
    const query = queryParams.toString();
    return apiRequest(`/health/records${query ? `?${query}` : ''}`);
  },

  updateRecord: async (id: string, record: {
    recordType: string;
    value: number;
    unit: string;
    notes?: string;
    recordedAt?: string;
  }) => {
    return apiRequest(`/health/records/${id}`, {
      method: 'PUT',
      body: JSON.stringify(record),
    });
  },

  deleteRecord: async (id: string) => {
    return apiRequest(`/health/records/${id}`, {
      method: 'DELETE',
    });
  },

  addSymptom: async (symptom: {
    symptomName: string;
    severity: number;
    notes?: string;
    recordedAt?: string;
  }) => {
    return apiRequest('/health/symptoms', {
      method: 'POST',
      body: JSON.stringify(symptom),
    });
  },

  getSymptoms: async (params?: {
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, String(value));
        }
      });
    }
    const query = queryParams.toString();
    return apiRequest(`/health/symptoms${query ? `?${query}` : ''}`);
  },

  updateSymptom: async (id: string, symptom: {
    symptomName: string;
    severity: number;
    notes?: string;
    recordedAt?: string;
  }) => {
    return apiRequest(`/health/symptoms/${id}`, {
      method: 'PUT',
      body: JSON.stringify(symptom),
    });
  },

  deleteSymptom: async (id: string) => {
    return apiRequest(`/health/symptoms/${id}`, {
      method: 'DELETE',
    });
  },

  getDashboard: async () => {
    return apiRequest('/health/dashboard');
  },

  getPredictions: async () => {
    return apiRequest('/health/predictions');
  },
};

// Mental Health API
export const mentalHealthAPI = {
  addMoodEntry: async (entry: {
    moodScore: number;
    energyLevel: number;
    anxietyLevel: number;
    notes?: string;
    recordedAt?: string;
  }) => {
    return apiRequest('/mental-health/mood', {
      method: 'POST',
      body: JSON.stringify(entry),
    });
  },

  getMoodEntries: async (params?: {
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, String(value));
        }
      });
    }
    const query = queryParams.toString();
    return apiRequest(`/mental-health/mood${query ? `?${query}` : ''}`);
  },

  submitAssessment: async (assessment: {
    assessmentType: string;
    responses: any;
    notes?: string;
  }) => {
    return apiRequest('/mental-health/assessment', {
      method: 'POST',
      body: JSON.stringify(assessment),
    });
  },

  getAssessments: async (params?: {
    type?: string;
    limit?: number;
    offset?: number;
  }) => {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, String(value));
        }
      });
    }
    const query = queryParams.toString();
    return apiRequest(`/mental-health/assessments${query ? `?${query}` : ''}`);
  },

  getInsights: async () => {
    return apiRequest('/mental-health/insights');
  },

  getDashboard: async () => {
    return apiRequest('/mental-health/dashboard');
  },

  submitDetailedAssessment: async (data: {
    assessmentData: any;
  }) => {
    try {
      return await apiRequest('/mental-health/detailed-assessment', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (error: any) {
      console.error('API Error in submitDetailedAssessment:', error);
      return {
        success: false,
        message: error.message || 'Failed to submit assessment',
        error: error.message
      };
    }
  },
};

// Users API
export const usersAPI = {
  getDashboard: async () => {
    return apiRequest('/users/dashboard');
  },
};

// Emergency API
export const emergencyAPI = {
  getResources: async (params?: {
    type?: string;
    state?: string;
    language?: 'en' | 'hi' | 'mr';
  }) => {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, String(value));
        }
      });
    }
    const query = queryParams.toString();
    return apiRequest(`/emergency/resources${query ? `?${query}` : ''}`);
  },

  getStates: async () => {
    return apiRequest('/emergency/states');
  },

  getResource: async (id: string) => {
    return apiRequest(`/emergency/resources/${id}`);
  },

  logAlert: async (alert: {
    type: string;
    message?: string;
    location?: string;
    state?: string;
    language?: 'en' | 'hi' | 'mr';
    trustedContact?: {
      name?: string;
      phone?: string;
      relationship?: string;
      email?: string;
    } | null;
  }) => {
    return apiRequest('/emergency/alert', {
      method: 'POST',
      body: JSON.stringify(alert),
    });
  },

  getAlerts: async (params?: {
    limit?: number;
    offset?: number;
  }) => {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, String(value));
        }
      });
    }
    const query = queryParams.toString();
    return apiRequest(`/emergency/alerts${query ? `?${query}` : ''}`);
  },

  updateAlert: async (id: string, status: string) => {
    return apiRequest(`/emergency/alerts/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  },

  trackEvent: async (eventType: string, metadata?: Record<string, any>) => {
    return apiRequest('/emergency/track', {
      method: 'POST',
      body: JSON.stringify({ eventType, metadata }),
    });
  },

  getAnalytics: async () => {
    return apiRequest('/emergency/analytics');
  },

  getTrustedContact: async () => {
    return apiRequest('/emergency/trusted-contact');
  },

  saveTrustedContact: async (contact: {
    name: string;
    phone: string;
    relationship: string;
    email?: string;
  }) => {
    return apiRequest('/emergency/trusted-contact', {
      method: 'PUT',
      body: JSON.stringify(contact),
    });
  },

  getSafetyPlan: async () => {
    return apiRequest('/emergency/safety-plan');
  },

  saveSafetyPlan: async (plan: {
    warningSigns: string[];
    copingActions: string[];
    trustedPeople: string[];
    emergencySteps: string[];
  }) => {
    return apiRequest('/emergency/safety-plan', {
      method: 'POST',
      body: JSON.stringify(plan),
    });
  },
};

// Education API
export const educationAPI = {
  getResources: async (params?: {
    category?: string;
    type?: string;
    featured?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }) => {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, String(value));
        }
      });
    }
    const query = queryParams.toString();
    return apiRequest(`/education/resources${query ? `?${query}` : ''}`);
  },

  getResource: async (id: string | number) => {
    return apiRequest(`/education/resources/${id}`);
  },

  getCategories: async () => {
    return apiRequest('/education/categories');
  },
};

// Community API
export const communityAPI = {
  getPosts: async (params?: {
    category?: string;
    limit?: number;
    offset?: number;
    search?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, String(value));
        }
      });
    }
    const query = queryParams.toString();
    return apiRequest(`/community/posts${query ? `?${query}` : ''}`);
  },

  createPost: async (post: {
    title?: string;
    content: string;
    category?: string;
    tags?: string[];
    isAnonymous?: boolean;
    isSupportRequest?: boolean;
  }) => {
    return apiRequest('/community/posts', {
      method: 'POST',
      body: JSON.stringify(post),
    });
  },

  getReplies: async (postId: string, params?: {
    limit?: number;
    offset?: number;
  }) => {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, String(value));
        }
      });
    }
    const query = queryParams.toString();
    return apiRequest(`/community/posts/${postId}/replies${query ? `?${query}` : ''}`);
  },

  addReply: async (postId: string, reply: {
    content: string;
    isAnonymous?: boolean;
  }) => {
    return apiRequest(`/community/posts/${postId}/replies`, {
      method: 'POST',
      body: JSON.stringify(reply),
    });
  },

  likePost: async (postId: string) => {
    return apiRequest(`/community/posts/${postId}/like`, {
      method: 'POST',
    });
  },

  likeReply: async (postId: string, replyId: string) => {
    return apiRequest(`/community/posts/${postId}/replies/${replyId}/like`, {
      method: 'POST',
    });
  },

  reactPost: async (postId: string, reactionType: 'like' | 'heart' | 'hug' | 'pray' | 'strong') => {
    return apiRequest(`/community/posts/${postId}/react`, {
      method: 'POST',
      body: JSON.stringify({ reactionType }),
    });
  },

  reportPost: async (postId: string, reason: string) => {
    return apiRequest(`/community/posts/${postId}/report`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  toggleBookmark: async (postId: string) => {
    return apiRequest(`/community/posts/${postId}/bookmark`, {
      method: 'POST',
    });
  },

  getBookmarks: async () => {
    return apiRequest('/community/bookmarks');
  },

  updatePost: async (
    postId: string,
    payload: { content: string; category?: string; tags?: string[] }
  ) => {
    return apiRequest(`/community/posts/${postId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  deletePost: async (postId: string) => {
    return apiRequest(`/community/posts/${postId}`, {
      method: 'DELETE',
    });
  },

  getAnalytics: async () => {
    return apiRequest('/community/analytics');
  },

  getExperts: async () => {
    return apiRequest('/community/experts');
  },
};

// Questionnaire API
export const questionnaireAPI = {
  submit: async (data: {
    questionnaire_type?: string;
    responses: Record<string, any>;
    metadata?: Record<string, any>;
  }) => {
    return apiRequest('/questionnaire/submit', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getResponses: async (params?: {
    type?: string;
    limit?: number;
    offset?: number;
  }) => {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, String(value));
        }
      });
    }
    const query = queryParams.toString();
    return apiRequest(`/questionnaire/responses${query ? `?${query}` : ''}`);
  },

  getLatest: async (type?: string) => {
    const query = type ? `?type=${type}` : '';
    return apiRequest(`/questionnaire/latest${query}`);
  },

  getStats: async () => {
    return apiRequest('/questionnaire/stats');
  },
};

export default {
  authAPI,
  healthAPI,
  mentalHealthAPI,
  usersAPI,
  emergencyAPI,
  educationAPI,
  communityAPI,
  questionnaireAPI,
};
