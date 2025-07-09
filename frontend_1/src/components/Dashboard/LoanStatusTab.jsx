import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Alert
} from '@mui/material';
import { loanService } from '../../services/api';

function LoanStatusTab() {
  const { data: loansResponse, isLoading, error } = useQuery({
    queryKey: ['loans'],
    queryFn: () => loanService.getAllLoans().then(res => res.data)
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
        Error loading loans: {error.message}
      </Alert>
    );
  }

  const loans = loansResponse?.data || [];
  const summary = loansResponse?.summary || {};

  // Helper function for loan status colors
  const getLoanStatusColor = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'due_soon': return 'warning';
      case 'due_this_week': return 'warning';
      case 'due_this_month': return 'info';
      case 'overdue': return 'error';
      case 'overdue-extension': return 'warning';  // Same as "due this week"
      case 'completed': return 'default';
      case 'starting_soon': return 'info';
      case 'pending': return 'default';
      default: return 'default';
    }
  };

  // Helper function for interest status colors
  const getInterestStatusColor = (status) => {
    switch (status) {
      case 'paid': return 'success';           // Green like ACTIVE
      case 'partial': return 'error';          // Red like OVERDUE
      case 'overdue': return 'error';          // Red
      case 'overdue-extension': return 'warning';  // Orange like "due this week"
      case 'pending': return 'default';        // Default gray
      case 'current': return 'success';        // Keep existing
      case 'upcoming': return 'info';          // Keep existing
      case 'due_soon': return 'warning';       // Keep existing
      default: return 'default';
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(amount);
  };

  const formatStatus = (status) => {
    return status.replace(/_/g, ' ').replace(/-/g, ' ').toUpperCase();
  };

  // Helper function to format payment completion percentage
  const formatPaymentCompletion = (completion) => {
    const percentage = completion || 0;
    // If payment is more than 99.9%, show 100%
    return percentage > 99.9 ? 100 : Math.round(percentage * 100) / 100;
  };

  return (
    <Grid container spacing={3}>
      {/* Summary Cards */}
      <Grid item xs={12} md={3}>
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              Total Active Loans
            </Typography>
            <Typography variant="h4" color="primary">
              {loans.length}
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      
      <Grid item xs={12} md={3}>
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              Due Soon (7 days)
            </Typography>
            <Typography variant="h4" color="warning.main">
              {summary.due_soon_loans || 0}
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      
      <Grid item xs={12} md={3}>
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              Overdue Loans
            </Typography>
            <Typography variant="h4" color="error">
              {summary.overdue_loans || 0}
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      
      <Grid item xs={12} md={3}>
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              Portfolio Value
            </Typography>
            <Typography variant="h5" color="success.main">
              {formatCurrency(summary.total_loan_value || 0)}
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      {/* Interest Status Summary */}
      <Grid item xs={12} md={4}>
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              Interest Paid
            </Typography>
            <Typography variant="h4" color="success.main">
              {summary.interest_paid || 0}
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      
      <Grid item xs={12} md={4}>
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              Interest Overdue
            </Typography>
            <Typography variant="h4" color="error">
              {summary.interest_overdue || 0}
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      
      <Grid item xs={12} md={4}>
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              Interest Partial
            </Typography>
            <Typography variant="h4" color="warning.main">
              {summary.interest_partial || 0}
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      {/* Loans Table */}
      <Grid item xs={12}>
        <Typography variant="h6" gutterBottom>
          All Active Loans
        </Typography>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Stage ID</TableCell>
                <TableCell>Project</TableCell>
                <TableCell>Loan Amount</TableCell>
                <TableCell>Interest Rate</TableCell>
                <TableCell>Start Date</TableCell>
                <TableCell>End Date</TableCell>
                <TableCell>Days to Maturity</TableCell>
                <TableCell>Loan Status</TableCell>
                <TableCell>Interest Status</TableCell>
                <TableCell>Interest Paid</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loans.map((loan) => (
                <TableRow key={`stage-${loan.id}`}>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">
                      {loan.id}
                    </Typography>
                  </TableCell>
                  <TableCell>{loan.project_title}</TableCell>
                  <TableCell>{formatCurrency(loan.loan_amount)}</TableCell>
                  <TableCell>{loan.annual_interest_rate}%</TableCell>
                  <TableCell>{new Date(loan.start_date).toLocaleDateString()}</TableCell>
                  <TableCell>{new Date(loan.end_date).toLocaleDateString()}</TableCell>
                  <TableCell>{loan.days_to_maturity}</TableCell>
                  <TableCell>
                    <Chip 
                      label={formatStatus(loan.loan_status || 'unknown')}
                      color={getLoanStatusColor(loan.loan_status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={formatStatus(loan.interest_status || 'unknown')}
                      color={getInterestStatusColor(loan.interest_status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatCurrency(loan.total_interest_paid || 0)}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      ({formatPaymentCompletion(loan.payment_completion)}%)
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Grid>
    </Grid>
  );
}

export default LoanStatusTab;