import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Typography,
  Card,
  CardContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  Chip,
  Button,
  Grid,
  CircularProgress,
  Alert,
  Box,
  Checkbox,
  FormControlLabel,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Payment as PaymentIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as UncheckedIcon
} from '@mui/icons-material';
import { reminderService } from '../../services/api';

function InvestorRemindersTab() {
  const queryClient = useQueryClient();
  const [daysAhead, setDaysAhead] = useState(30);
  const [noteDialog, setNoteDialog] = useState({ open: false, reminderKey: '', currentState: false });
  const [userNote, setUserNote] = useState('');

  const { data: investorRemindersResponse, isLoading, error } = useQuery({
    queryKey: ['investorReminders', daysAhead],
    queryFn: () => reminderService.getInvestorReminders(daysAhead).then(res => res.data)
  });

  const markPaymentMutation = useMutation({
    mutationFn: ({ reminderKey, isPaid, isIgnored, userNote }) => 
      reminderService.markInvestorPaymentStatus(reminderKey, isPaid, isIgnored, userNote),
    onSuccess: () => {
      queryClient.invalidateQueries(['investorReminders']);
      setNoteDialog({ open: false, reminderKey: '', currentState: false });
      setUserNote('');
    }
  });

  const handlePaymentToggle = (reminderKey, currentState) => {
    if (!currentState) {
      // Marking as paid - show note dialog
      setNoteDialog({ open: true, reminderKey, currentState });
    } else {
      // Marking as unpaid - do directly
      markPaymentMutation.mutate({ reminderKey, isPaid: false, isIgnored: false, userNote: '' });
    }
  };

  const handleIgnoreToggle = (reminderKey, currentIgnoreState) => {
    if (!currentIgnoreState) {
      // Marking as ignored - do directly
      markPaymentMutation.mutate({ reminderKey, isPaid: false, isIgnored: true, userNote: 'Ignored' });
    } else {
      // Unmarking ignore - do directly
      markPaymentMutation.mutate({ reminderKey, isPaid: false, isIgnored: false, userNote: '' });
    }
  };

  const handleConfirmPayment = () => {
    markPaymentMutation.mutate({ 
      reminderKey: noteDialog.reminderKey, 
      isPaid: true, 
      isIgnored: false,
      userNote 
    });
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Error loading investor reminders: {error.message}
      </Alert>
    );
  }

  const rawReminders = investorRemindersResponse?.data || [];
  const summary = investorRemindersResponse?.summary || {};

  // Helper functions - declare before using
  const isProjectFullyPaid = (project) => {
    // Check if all payments in the project are either paid or ignored
    // Note: Backend stores data for 3 years but hides paid/ignored from frontend after 15 days
    return project.upcomingPayments.every(payment => payment.isPaid || payment.isIgnored);
  };

  const getProjectUrgencyLevel = (project) => {
    if (isProjectFullyPaid(project)) {
      return 'completed'; // Override urgency for fully paid projects
    }
    return project.urgencyLevel; // Use original urgency level
  };

  // Sort projects: active projects first, then fully paid projects at the bottom
  const reminders = [...rawReminders].sort((a, b) => {
    const aFullyPaid = isProjectFullyPaid(a);
    const bFullyPaid = isProjectFullyPaid(b);
    
    // If one is fully paid and the other isn't, put the unpaid one first
    if (aFullyPaid && !bFullyPaid) return 1;
    if (!aFullyPaid && bFullyPaid) return -1;
    
    // If both have the same payment status, sort by urgency and earliest payment
    const aUrgency = getProjectUrgencyLevel(a);
    const bUrgency = getProjectUrgencyLevel(b);
    
    if (aUrgency === 'urgent' && bUrgency !== 'urgent') return -1;
    if (bUrgency === 'urgent' && aUrgency !== 'urgent') return 1;
    
    // Finally sort by earliest payment date
    const aEarliestPayment = Math.min(...a.upcomingPayments.map(p => p.daysUntilPayment));
    const bEarliestPayment = Math.min(...b.upcomingPayments.map(p => p.daysUntilPayment));
    return aEarliestPayment - bEarliestPayment;
  });

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

  const getDaysUntilColor = (days, isPaid, isIgnored) => {
    if (isPaid) return 'success';
    if (isIgnored) return 'default';
    if (days < 0) return 'error';
    if (days <= 7) return 'warning';
    return 'info';
  };

  const getDaysUntilText = (days) => {
    if (days < 0) return `${Math.abs(days)} days overdue`;
    if (days === 0) return 'Due today';
    return `${days} days`;
  };

  const getPaymentItemStyle = (payment) => {
    if (payment.isPaid) {
      return { backgroundColor: '#f5f5f5', color: '#666' }; // Gray for paid
    }
    if (payment.isIgnored) {
      return { backgroundColor: '#fafafa', color: '#999', fontStyle: 'italic' }; // Light gray for ignored
    }
    if (payment.daysUntilPayment < 0) {
      return { backgroundColor: '#ffebee', color: '#c62828' }; // Red background for overdue
    }
    return {}; // Default styling
  };

  const getProjectStyle = (project) => {
    if (isProjectFullyPaid(project)) {
      return { 
        backgroundColor: '#f5f5f5', 
        color: '#666',
        opacity: 0.7
      }; // Gray out fully paid projects
    }
    return {}; // Default styling
  };

  const getUrgencyColorForProject = (project) => {
    const urgencyLevel = getProjectUrgencyLevel(project);
    switch (urgencyLevel) {
      case 'urgent': return 'error';
      case 'upcoming': return 'warning';
      case 'completed': return 'success';
      default: return 'info';
    }
  };

  const getUrgencyLabelForProject = (project) => {
    const urgencyLevel = getProjectUrgencyLevel(project);
    switch (urgencyLevel) {
      case 'urgent': return 'URGENT';
      case 'upcoming': return 'UPCOMING';
      case 'completed': return 'ALL PAID';
      default: return 'INFO';
    }
  };

  return (
    <div>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">
          💰 Investor Payment Reminders
        </Typography>
        <TextField
          label="Days Ahead"
          type="number"
          value={daysAhead}
          onChange={(e) => setDaysAhead(parseInt(e.target.value) || 30)}
          size="small"
          sx={{ width: 120 }}
        />
      </Box>
      
      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Projects with Payments
              </Typography>
              <Typography variant="h5" color="primary">
                {summary.totalProjects || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Total Investors
              </Typography>
              <Typography variant="h5" color="info.main">
                {summary.totalInvestors || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Total Payment Amount
              </Typography>
              <Typography variant="h6" color="success.main">
                {formatCurrency(summary.totalPaymentAmount || 0)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ bgcolor: reminders.filter(p => getProjectUrgencyLevel(p) === 'urgent').length > 0 ? 'error.main' : 'success.main', color: 'white' }}>
            <CardContent>
              <Typography color="inherit" gutterBottom variant="body2">
                Urgent Payments (≤7 days)
              </Typography>
              <Typography variant="h5" color="inherit">
                {reminders.filter(p => getProjectUrgencyLevel(p) === 'urgent').reduce((sum, p) => sum + p.upcomingPayments.filter(pay => pay.urgencyLevel === 'urgent' && !pay.isPaid && !pay.isIgnored).length, 0)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ bgcolor: 'success.light', color: 'white' }}>
            <CardContent>
              <Typography color="inherit" gutterBottom variant="body2">
                Fully Paid Projects
              </Typography>
              <Typography variant="h5" color="inherit">
                {reminders.filter(p => isProjectFullyPaid(p)).length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* Payment Status Summary */}
      <Card sx={{ mb: 3, bgcolor: 'grey.50' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Payment Status Overview</Typography>
          <Grid container spacing={2}>
            <Grid item xs={6} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h5" color="error">{reminders.reduce((sum, p) => sum + p.upcomingPayments.filter(pay => !pay.isPaid && !pay.isIgnored).length, 0)}</Typography>
                <Typography variant="body2">Active</Typography>
              </Box>
            </Grid>
            <Grid item xs={6} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h5" color="success.main">{reminders.reduce((sum, p) => sum + p.upcomingPayments.filter(pay => pay.isPaid).length, 0)}</Typography>
                <Typography variant="body2">Paid</Typography>
              </Box>
            </Grid>
            <Grid item xs={6} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h5" color="text.secondary">{reminders.reduce((sum, p) => sum + p.upcomingPayments.filter(pay => pay.isIgnored).length, 0)}</Typography>
                <Typography variant="body2">Ignored</Typography>
              </Box>
            </Grid>
            <Grid item xs={6} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h5" color="error.dark">{reminders.reduce((sum, p) => sum + p.upcomingPayments.filter(pay => pay.daysUntilPayment < 0 && !pay.isPaid && !pay.isIgnored).length, 0)}</Typography>
                <Typography variant="body2">Overdue</Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
      
      {/* Projects with Upcoming Payments */}
      <Typography variant="h6" gutterBottom>
        Projects with Upcoming Investor Payments
      </Typography>
      <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
        Fully paid projects appear at the bottom in gray and disappear from view after 15 days. Data is kept for 3 years for records. Unchecking any payment will restore the project to active status.
      </Typography>
      
      {reminders.length === 0 ? (
        <Alert severity="info">
          No upcoming investor payments in the next {daysAhead} days.
        </Alert>
      ) : (
        reminders.map((project) => (
          <Accordion key={project.projectId} sx={{ mb: 2, ...getProjectStyle(project) }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', mr: 2 }}>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="h6">
                    {project.projectTitle}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Stage ID: {project.stageId} • Loan Amount: {formatCurrency(project.loanAmount)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Chip 
                    label={`${project.totalInvestorsCount} Investors`}
                    size="small"
                    icon={<PersonIcon />}
                  />
                  <Chip 
                    label={formatCurrency(project.totalPaymentAmount)}
                    size="small"
                    color="primary"
                    icon={<PaymentIcon />}
                  />
                  <Chip 
                    label={getUrgencyLabelForProject(project)}
                    color={getUrgencyColorForProject(project)}
                    size="small"
                  />
                </Box>
              </Box>
            </AccordionSummary>
            
            <AccordionDetails>
              <List dense>
                {project.upcomingPayments.map((payment, index) => (
                  <div key={payment.reminderKey}>
                      <ListItem sx={{ pl: 0, ...getPaymentItemStyle(payment) }}>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="subtitle1" fontWeight="bold">
                                {payment.investorName}
                              </Typography>
                              {payment.investorEmail && (
                                <Tooltip title={payment.investorEmail}>
                                  <EmailIcon fontSize="small" color="action" />
                                </Tooltip>
                              )}
                              {payment.investorPhone && (
                                <Tooltip title={payment.investorPhone}>
                                  <PhoneIcon fontSize="small" color="action" />
                                </Tooltip>
                              )}
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography variant="body2">
                                Investment: {formatCurrency(payment.investmentAmount)} at {payment.annualRate.toFixed(2)}% annual
                              </Typography>
                              <Typography variant="body2">
                                Monthly Payment: <strong>{formatCurrency(payment.monthlyPayment)}</strong>
                                {payment.isProrated && (
                                  <Chip 
                                    label={`Prorated (${payment.proratedDays} days)`}
                                    size="small"
                                    color="info"
                                    variant="outlined"
                                    sx={{ ml: 1, fontSize: '0.7rem', height: '20px' }}
                                  />
                                )}
                              </Typography>
                              <Typography variant="body2">
                                Due Date: <strong>{new Date(payment.scheduledDate).toLocaleDateString()}</strong>
                              </Typography>
                              {payment.isProrated && (
                                <Typography variant="body2" color="info.main" sx={{ fontStyle: 'italic', fontSize: '0.875rem' }}>
                                  Final payment prorated for {payment.proratedDays} remaining days
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                        
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip 
                            label={getDaysUntilText(payment.daysUntilPayment)}
                            color={getDaysUntilColor(payment.daysUntilPayment, payment.isPaid, payment.isIgnored)}
                            size="small"
                          />
                          
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={Boolean(payment.isPaid)}
                                onChange={() => handlePaymentToggle(payment.reminderKey, payment.isPaid)}
                                icon={<UncheckedIcon />}
                                checkedIcon={<CheckCircleIcon />}
                                disabled={markPaymentMutation.isLoading || payment.isIgnored}
                              />
                            }
                            label={payment.isPaid ? "Paid" : "Mark as Paid"}
                          />
                          
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={Boolean(payment.isIgnored)}
                                onChange={() => handleIgnoreToggle(payment.reminderKey, payment.isIgnored)}
                                icon={<UncheckedIcon />}
                                checkedIcon={<CheckCircleIcon />}
                                disabled={markPaymentMutation.isLoading || payment.isPaid}
                              />
                            }
                            label={payment.isIgnored ? "Ignored" : "Ignore"}
                          />
                          
                          {payment.isPaid && payment.markedPaidAt ? (
                            <Tooltip title={`Marked paid at ${new Date(payment.markedPaidAt).toLocaleString()}`}>
                              <CheckCircleIcon color="success" fontSize="small" />
                            </Tooltip>
                          ) : null}
                          
                          {payment.isIgnored && payment.markedIgnoredAt ? (
                            <Tooltip title={`Marked ignored at ${new Date(payment.markedIgnoredAt).toLocaleString()}`}>
                              <CheckCircleIcon color="disabled" fontSize="small" />
                            </Tooltip>
                          ) : null}
                        </Box>
                      </ListItem>
                      {index < project.upcomingPayments.length - 1 && <Divider />}
                    </div>
                  ))}
                </List>
            </AccordionDetails>
          </Accordion>
        ))
      )}
      
      {/* Confirm Payment Dialog */}
      <Dialog open={noteDialog.open} onClose={() => setNoteDialog({ open: false, reminderKey: '', currentState: false })} maxWidth="sm" fullWidth>
        <DialogTitle>Confirm Payment</DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            Are you sure you want to mark this investor payment as paid?
          </Typography>
          <TextField
            label="Payment Note (Optional)"
            multiline
            rows={3}
            fullWidth
            value={userNote}
            onChange={(e) => setUserNote(e.target.value)}
            placeholder="Add any notes about this payment..."
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNoteDialog({ open: false, reminderKey: '', currentState: false })}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirmPayment} 
            variant="contained" 
            disabled={markPaymentMutation.isLoading}
          >
            {markPaymentMutation.isLoading ? <CircularProgress size={20} /> : 'Confirm Payment'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

export default InvestorRemindersTab; 