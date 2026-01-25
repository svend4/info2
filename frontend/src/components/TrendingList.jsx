/**
 * Trending List Component
 *
 * Shows trending components
 */

import {
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Chip,
  Box,
  CircularProgress
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import StarIcon from '@mui/icons-material/Star';
import { useTrending } from '../hooks/useComponents';

export default function TrendingList() {
  const { trending, loading } = useTrending('week', 5);

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TrendingUpIcon color="error" />
          Популярные
        </Typography>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={30} />
          </Box>
        ) : (
          <List>
            {trending.map((component, index) => (
              <ListItem key={component.id} disablePadding>
                <ListItemButton
                  component="a"
                  href={`/component/${component.id}`}
                >
                  <ListItemIcon>
                    <Chip
                      label={index + 1}
                      size="small"
                      color={index === 0 ? 'error' : index === 1 ? 'warning' : 'default'}
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={component.name}
                    secondary={
                      <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <StarIcon sx={{ fontSize: 14 }} />
                        {component.stars?.toLocaleString()}
                      </Box>
                    }
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
}
