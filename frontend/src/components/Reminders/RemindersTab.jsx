import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Typography,
  List,
  ListItem,
  ListItemText,
  Chip,
  Button,
  Grid,
  CircularProgress,
  Alert,
  Card,
  CardContent
} from '@mui/material';
import { reminderService } from '../../services/api';

function RemindersTab() {
  const { data: remindersResponse, isLoading, error } = useQuery({
    queryKey: ['reminders'],
    queryFn: () => reminderService.getReminders().then(res => res.data)
  });

  if (isLoading) {
    return (
      <Grid container justifyContent="center">
        <CircularProgress />
      </Grid>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        Error loading reminders: {error.message}
      </Alert>
    );
  }

  const reminders = remindersResponse?.data || [];
  const summary = remindersResponse?.summary || {};

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(amount);
  };

  const getUrgencyColor = (urgency) => {
    switch (urgency) {
      case 'urgent': return 'error';
      case 'upcoming': return 'warning';
      default: return 'info';
    }
  };

  return (
    <div>
      <Typography variant="h5" gutterBottom>
        Payment Reminders
      </Typography>
      
      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Urgent (≤7 days)
              </Typography>
              <Typography variant="h4" color="error">
                {summary.urgent || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Upcoming (≤30 days)
              </Typography>
              <Typography variant="h4" color="warning.main">
                {summary.upcoming || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Overdue
              </Typography>
              <Typography variant="h4" color="error">
                {summary.overdue || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* Reminders List */}
      <Typography variant="h6" gutterBottom>
        Upcoming Payment Reminders
      </Typography>
      
      {reminders.length === 0 ? (
        <Alert severity="info">
          No upcoming payment reminders at this time.
        </Alert>
      ) : (
        <List>
          {reminders.map((reminder) => (
            <ListItem key={reminder.id} divider>
              <ListItemText
                primary={`${reminder.projectTitle}`}
                secondary={`Due: ${new Date(reminder.dueDate).toLocaleDateString()} | Amount: ${formatCurrency(reminder.loanAmount)} | Days: ${reminder.daysUntilDue}`}
              />
              <Chip 
                label={reminder.urgencyLevel.toUpperCase()}
                color={getUrgencyColor(reminder.urgencyLevel)}
                sx={{ mr: 2 }}
              />
              <Button 
                variant="outlined" 
                size="small"
                onClick={() => alert('Email reminder feature coming soon!')}
              >
                Send Reminder
              </Button>
            </ListItem>
          ))}
        </List>
      )}
    </div>
  );
}

export default RemindersTab;