/**
 * Stats Panel Component
 *
 * Displays T-Hub statistics
 */

import { Card, CardContent, Typography, Grid, Box, CircularProgress } from '@mui/material';
import CodeIcon from '@mui/icons-material/Code';
import DownloadIcon from '@mui/icons-material/Download';
import StarIcon from '@mui/icons-material/Star';
import CategoryIcon from '@mui/icons-material/Category';
import { useStats } from '../hooks/useComponents';

export default function StatsPanel({ sx }) {
  const { stats, loading } = useStats();

  if (loading) {
    return (
      <Card sx={sx}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    );
  }

  const statItems = [
    {
      icon: <CodeIcon fontSize="large" color="primary" />,
      label: 'Компонентов',
      value: stats?.totalComponents || 0
    },
    {
      icon: <DownloadIcon fontSize="large" color="success" />,
      label: 'Загрузок',
      value: (stats?.totalDownloads || 0).toLocaleString()
    },
    {
      icon: <StarIcon fontSize="large" color="warning" />,
      label: 'Звёзд',
      value: (stats?.totalStars || 0).toLocaleString()
    },
    {
      icon: <CategoryIcon fontSize="large" color="secondary" />,
      label: 'Категорий',
      value: Object.keys(stats?.categories || {}).length
    }
  ];

  return (
    <Card sx={sx}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Статистика T-Hub
        </Typography>
        <Grid container spacing={2}>
          {statItems.map((item, index) => (
            <Grid item xs={6} sm={3} key={index}>
              <Box sx={{ textAlign: 'center' }}>
                <Box sx={{ mb: 1 }}>{item.icon}</Box>
                <Typography variant="h6" component="div">
                  {item.value}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {item.label}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );
}
