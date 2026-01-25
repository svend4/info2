/**
 * T-Hub API Client
 * HTTP client for interacting with T-Hub API
 */

const axios = require('axios');
const fs = require('fs').promises;
const os = require('os');
const path = require('path');

class THubAPIClient {
  constructor(options = {}) {
    this.baseURL = options.baseURL || process.env.THUB_API_URL || 'http://localhost:3000';
    this.token = options.token || null;
    this.configPath = path.join(os.homedir(), '.thub', 'config.json');

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Add request interceptor for authentication
    this.client.interceptors.request.use(
      (config) => {
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response.data,
      (error) => {
        if (error.response) {
          const err = new Error(error.response.data.message || error.response.data.error || 'API Error');
          err.status = error.response.status;
          err.data = error.response.data;
          throw err;
        } else if (error.request) {
          throw new Error('No response from server. Is the API running?');
        } else {
          throw error;
        }
      }
    );
  }

  /**
   * Load configuration from file
   */
  async loadConfig() {
    try {
      const config = JSON.parse(await fs.readFile(this.configPath, 'utf8'));
      this.token = config.token;
      if (config.apiUrl) {
        this.baseURL = config.apiUrl;
        this.client.defaults.baseURL = config.apiUrl;
      }
      return config;
    } catch (error) {
      return null;
    }
  }

  /**
   * Save configuration to file
   */
  async saveConfig(config) {
    const dir = path.dirname(this.configPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
  }

  // =========================================================================
  // Authentication
  // =========================================================================

  async register(userData) {
    const response = await this.client.post('/api/v1/auth/register', userData);
    if (response.token) {
      this.token = response.token;
      await this.saveConfig({
        token: this.token,
        user: response.user,
        apiUrl: this.baseURL
      });
    }
    return response;
  }

  async login(email, password) {
    const response = await this.client.post('/api/v1/auth/login', { email, password });
    if (response.token) {
      this.token = response.token;
      await this.saveConfig({
        token: this.token,
        user: response.user,
        apiUrl: this.baseURL
      });
    }
    return response;
  }

  async getMe() {
    return await this.client.get('/api/v1/auth/me');
  }

  async logout() {
    this.token = null;
    try {
      await fs.unlink(this.configPath);
    } catch (error) {
      // Ignore if file doesn't exist
    }
  }

  // =========================================================================
  // Components
  // =========================================================================

  async listComponents(options = {}) {
    const params = new URLSearchParams();
    if (options.category) params.append('category', options.category);
    if (options.language) params.append('language', options.language);
    if (options.search) params.append('search', options.search);
    if (options.limit) params.append('limit', options.limit);
    if (options.offset) params.append('offset', options.offset);

    return await this.client.get(`/api/v1/components?${params}`);
  }

  async getComponent(id) {
    return await this.client.get(`/api/v1/components/${id}`);
  }

  async createComponent(componentData) {
    return await this.client.post('/api/v1/components', componentData);
  }

  async updateComponent(id, updates) {
    return await this.client.put(`/api/v1/components/${id}`, updates);
  }

  async deleteComponent(id) {
    return await this.client.delete(`/api/v1/components/${id}`);
  }

  async downloadComponent(id) {
    const response = await axios.get(`${this.baseURL}/api/v1/components/${id}/download`, {
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
      responseType: 'text'
    });
    return response.data;
  }

  // =========================================================================
  // Search
  // =========================================================================

  async search(query, options = {}) {
    const params = new URLSearchParams();
    params.append('q', query);
    if (options.limit) params.append('limit', options.limit);

    return await this.client.get(`/api/v1/search?${params}`);
  }

  async advancedSearch(searchOptions) {
    return await this.client.post('/api/v1/search/advanced', searchOptions);
  }

  async autocomplete(query, limit = 5) {
    return await this.client.get(`/api/v1/search/autocomplete?q=${query}&limit=${limit}`);
  }

  async findSimilar(componentId, limit = 5) {
    return await this.client.get(`/api/v1/components/${componentId}/similar?limit=${limit}`);
  }

  // =========================================================================
  // Statistics
  // =========================================================================

  async getStats() {
    return await this.client.get('/api/v1/stats');
  }

  async getTrending(period = 'week', limit = 10) {
    return await this.client.get(`/api/v1/trending?period=${period}&limit=${limit}`);
  }

  async getCategories() {
    return await this.client.get('/api/v1/categories');
  }

  // =========================================================================
  // Dependencies
  // =========================================================================

  async resolveDependencies(components) {
    return await this.client.post('/api/v1/resolve', { components });
  }

  async getDependents(componentId) {
    return await this.client.get(`/api/v1/components/${componentId}/dependents`);
  }

  // =========================================================================
  // Health
  // =========================================================================

  async getHealth() {
    return await this.client.get('/health');
  }

  async getDetailedHealth() {
    return await this.client.get('/api/v1/health/detailed');
  }
}

module.exports = THubAPIClient;
