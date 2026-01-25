/**
 * Component Card
 *
 * Displays component information in a card format
 */

import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Chip,
  Button,
  Box,
  IconButton,
  Tooltip
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import InfoIcon from '@mui/icons-material/Info';
import CodeIcon from '@mui/icons-material/Code';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

export default function ComponentCard({ component }) {
  const {
    id,
    name,
    version,
    description,
    category,
    language,
    author,
    downloads,
    stars,
    created_at,
    updated_at
  } = component;

  const handleDownload = () => {
    // Download component
    window.location.href = `/api/v1/components/${id}/download`;
  };

  const handleViewDetails = () => {
    window.location.href = `/component/${id}`;
  };

  const handleToggleStar = () => {
    // Toggle star (TODO: implement)
    console.log('Toggle star for', id);
  };

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 4
        }
      }}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
            <Typography variant="h6" component="div" gutterBottom>
              <CodeIcon sx={{ mr: 1, verticalAlign: 'middle', fontSize: 20 }} />
              {name}
              <Chip
                label={`v${version}`}
                size="small"
                sx={{ ml: 1 }}
                variant="outlined"
              />
            </Typography>
            <Typography variant="body2" color="text.secondary">
              by {author?.name || 'Unknown'}
            </Typography>
          </Box>

          <Tooltip title={`Добавить в избранное`}>
            <IconButton onClick={handleToggleStar} size="small">
              <StarBorderIcon />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Description */}
        <Typography variant="body1" color="text.primary" sx={{ mb: 2 }}>
          {description || 'No description available'}
        </Typography>

        {/* Tags */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
          <Chip
            label={category}
            size="small"
            color="primary"
            variant="outlined"
          />
          <Chip
            label={language}
            size="small"
            color="secondary"
            variant="outlined"
          />
        </Box>

        {/* Stats */}
        <Box sx={{ display: 'flex', gap: 3, mt: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <DownloadIcon fontSize="small" color="action" />
            <Typography variant="body2" color="text.secondary">
              {downloads?.toLocaleString() || 0}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <StarIcon fontSize="small" color="action" />
            <Typography variant="body2" color="text.secondary">
              {stars?.toLocaleString() || 0}
            </Typography>
          </Box>
        </Box>

        {/* Updated */}
        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
          Обновлено: {formatDistanceToNow(new Date(updated_at), { addSuffix: true, locale: ru })}
        </Typography>
      </CardContent>

      <CardActions sx={{ px: 2, pb: 2 }}>
        <Button
          size="small"
          startIcon={<InfoIcon />}
          onClick={handleViewDetails}
        >
          Подробнее
        </Button>
        <Button
          size="small"
          variant="contained"
          startIcon={<DownloadIcon />}
          onClick={handleDownload}
          sx={{ ml: 'auto' }}
        >
          Скачать
        </Button>
      </CardActions>
    </Card>
  );
}
