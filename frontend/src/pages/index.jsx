/**
 * T-Hub Frontend - Home Page
 *
 * Main page with search and trending components
 */

import { useState, useEffect } from 'react';
import {
  Container,
  Grid,
  TextField,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Box,
  InputAdornment,
  CircularProgress,
  Alert
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/Download';
import StarIcon from '@mui/icons-material/Star';
import CodeIcon from '@mui/icons-material/Code';

import { useComponents } from '../hooks/useComponents';
import ComponentCard from '../components/ComponentCard';
import StatsPanel from '../components/StatsPanel';
import TrendingList from '../components/TrendingList';

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const { components, loading, error, refetch } = useComponents({
    search: searchQuery,
    category: selectedCategory !== 'all' ? selectedCategory : undefined
  });

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 6, textAlign: 'center' }}>
        <Typography variant="h2" component="h1" gutterBottom>
          <CodeIcon sx={{ fontSize: 48, mr: 2, verticalAlign: 'middle' }} />
          T-Hub
        </Typography>
        <Typography variant="h5" color="text.secondary" gutterBottom>
          Thesaurus Hub for Software Components
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Единый реестр уникальных программных компонентов
        </Typography>
      </Box>

      {/* Search Bar */}
      <Box sx={{ mb: 4 }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Поиск компонентов... (например: jwt, validator, query-builder)"
          value={searchQuery}
          onChange={handleSearch}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            )
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              fontSize: '1.2rem',
              padding: '8px'
            }
          }}
        />
      </Box>

      {/* Category Filters */}
      <Box sx={{ mb: 4, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {['all', 'authentication', 'api', 'data', 'ui', 'security', 'utilities'].map(cat => (
          <Chip
            key={cat}
            label={cat.charAt(0).toUpperCase() + cat.slice(1)}
            onClick={() => setSelectedCategory(cat)}
            color={selectedCategory === cat ? 'primary' : 'default'}
            variant={selectedCategory === cat ? 'filled' : 'outlined'}
            sx={{ cursor: 'pointer' }}
          />
        ))}
      </Box>

      <Grid container spacing={4}>
        {/* Main Content */}
        <Grid item xs={12} md={8}>
          {/* Stats Panel */}
          <StatsPanel sx={{ mb: 4 }} />

          {/* Components List */}
          <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
            {searchQuery ? `Результаты поиска: "${searchQuery}"` : 'Все компоненты'}
          </Typography>

          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Ошибка загрузки: {error.message}
            </Alert>
          )}

          {!loading && !error && components.length === 0 && (
            <Alert severity="info">
              Компоненты не найдены. Попробуйте изменить запрос.
            </Alert>
          )}

          {!loading && !error && components.length > 0 && (
            <Grid container spacing={3}>
              {components.map(component => (
                <Grid item xs={12} key={component.id}>
                  <ComponentCard component={component} />
                </Grid>
              ))}
            </Grid>
          )}
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} md={4}>
          <TrendingList />
        </Grid>
      </Grid>
    </Container>
  );
}
