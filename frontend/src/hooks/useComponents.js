/**
 * Custom hook for fetching components
 */

import { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export function useComponents(options = {}) {
  const [components, setComponents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const {
    search,
    category,
    language,
    limit = 10,
    offset = 0
  } = options;

  const fetchComponents = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (category) params.append('category', category);
      if (language) params.append('language', language);
      params.append('limit', limit);
      params.append('offset', offset);

      const response = await axios.get(
        `${API_BASE_URL}/api/v1/components?${params.toString()}`
      );

      setComponents(response.data.data || []);
    } catch (err) {
      setError(err);
      console.error('Error fetching components:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComponents();
  }, [search, category, language, limit, offset]);

  return {
    components,
    loading,
    error,
    refetch: fetchComponents
  };
}

export function useComponent(id) {
  const [component, setComponent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;

    const fetchComponent = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await axios.get(
          `${API_BASE_URL}/api/v1/components/${id}`
        );

        setComponent(response.data);
      } catch (err) {
        setError(err);
        console.error('Error fetching component:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchComponent();
  }, [id]);

  return { component, loading, error };
}

export function useStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await axios.get(`${API_BASE_URL}/api/v1/stats`);
        setStats(response.data);
      } catch (err) {
        setError(err);
        console.error('Error fetching stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return { stats, loading, error };
}

export function useTrending(period = 'week', limit = 10) {
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTrending = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await axios.get(
          `${API_BASE_URL}/api/v1/trending?period=${period}&limit=${limit}`
        );

        setTrending(response.data.trending || []);
      } catch (err) {
        setError(err);
        console.error('Error fetching trending:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTrending();
  }, [period, limit]);

  return { trending, loading, error };
}
