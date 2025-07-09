import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Typography,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Divider,
  Box,
  Chip
} from '@mui/material';
import { cashflowService } from '../../services/api';

function CashFlowTab() {
  const { data: cashflowResponse, isLoading, error } = useQuery({
    queryKey: ['cashflow'],
    queryFn: () => cashflowService.getMonthlyCashflow().then(res => res.data)
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
        Error loading cashflow data: {error.message}
      </Alert>
    );
  }

  const cashflowData = cashflowResponse?.data || [];
  const summary = cashflowResponse?.summary || {};

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(amount);
  };

  return (
    <div>
      <Typography variant="h5" gutterBottom>
        12-Month NET Cashflow Prediction
      </Typography>
      
      {/* Summary Card */}
      <Card sx={{ mb: 3, bgcolor: 'primary.main', color: 'primary.contrastText' }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <Typography variant="subtitle2">Total Inflows</Typography>
              <Typography variant="h6">
                {formatCurrency(summary.totalInflows || 0)}
              </Typography>
            </Grid>
            <Grid item xs={12} md={3}>
              <Typography variant="subtitle2">Total Outflows</Typography>
              <Typography variant="h6">
                {formatCurrency(summary.totalOutflows || 0)}
              </Typography>
            </Grid>
            <Grid item xs={12} md={3}>
              <Typography variant="subtitle2">NET Cashflow</Typography>
              <Typography variant="h6" sx={{ 
                color: (summary.totalNetCashflow || 0) >= 0 ? 'success.light' : 'error.light' 
              }}>
                {formatCurrency(summary.totalNetCashflow || 0)}
              </Typography>
            </Grid>
            <Grid item xs={12} md={3}>
              <Typography variant="subtitle2">Collection Rate (Net)</Typography>
              <Typography variant="h6">
                {summary.paymentAnalysis?.collectionRateNet || 0}%
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Payment Analysis Card */}
      {summary.paymentAnalysis && (
        <Card sx={{ mb: 3, bgcolor: 'info.main', color: 'info.contrastText' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              📊 Payment Analysis (Actual vs Expected)
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6} md={3}>
                <Typography variant="subtitle2">Loans with Payments</Typography>
                <Typography variant="h6">
                  {summary.paymentAnalysis.loansWithPayments}/{summary.paymentAnalysis.totalLoans}
                </Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="subtitle2">Fully Paid</Typography>
                <Typography variant="h6">
                  {summary.paymentAnalysis.fullyPaidLoans}
                </Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="subtitle2">Partially Paid</Typography>
                <Typography variant="h6">
                  {summary.paymentAnalysis.partiallyPaidLoans}
                </Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="subtitle2">Unpaid Loans</Typography>
                <Typography variant="h6">
                  {summary.paymentAnalysis.unpaidLoans}
                </Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2">Actual Payments (Gross)</Typography>
                <Typography variant="h6">
                  {formatCurrency(summary.paymentAnalysis.totalActualPaymentsGross || 0)}
                </Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2">Actual Payments (Net)</Typography>
                <Typography variant="h6" color="success.main">
                  {formatCurrency(summary.paymentAnalysis.totalActualPaymentsNet || 0)}
                </Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2">Expected Payments</Typography>
                <Typography variant="h6">
                  {formatCurrency(summary.paymentAnalysis.totalExpectedPayments || 0)}
                </Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="subtitle2">Total Taxes</Typography>
                <Typography variant="h6" color="warning.main">
                  {formatCurrency(summary.paymentAnalysis.totalTaxesPaid || 0)}
                </Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="subtitle2">Total Fees</Typography>
                <Typography variant="h6" color="warning.main">
                  {formatCurrency(summary.paymentAnalysis.totalFeesPaid || 0)}
                </Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="subtitle2">Collection Rate (Gross)</Typography>
                <Typography variant="h6">
                  {summary.paymentAnalysis.collectionRateGross || 0}%
                </Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="subtitle2">Collection Rate (Net)</Typography>
                <Typography variant="h6" color="success.main">
                  {summary.paymentAnalysis.collectionRateNet || 0}%
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}
      
      {/* Monthly Breakdown */}
      <Grid container spacing={2}>
        {cashflowData.slice(0, 6).map((month, index) => (
          <Grid item xs={12} md={6} lg={4} key={index}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {month.monthName}
                </Typography>
                
                {/* Inflows */}
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" color="success.main" gutterBottom>
                    💰 Cash Inflows (NET)
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Interest Income (Net): {formatCurrency(month.totalInterestReceivable)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Principal: {formatCurrency(month.totalPrincipalDue)}
                  </Typography>
                  <Typography variant="body2" fontWeight="bold" color="success.main">
                    Total In: {formatCurrency(month.totalCashInflow)}
                  </Typography>
                </Box>

                {/* Taxes and Fees */}
                {(month.totalTaxes > 0 || month.totalFees > 0) && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" color="warning.main" gutterBottom>
                      📋 Taxes & Fees
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Taxes: {formatCurrency(month.totalTaxes || 0)}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Fees: {formatCurrency(month.totalFees || 0)}
                    </Typography>
                  </Box>
                )}

                <Divider sx={{ my: 1 }} />

                {/* Outflows */}
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" color="error.main" gutterBottom>
                    💸 Cash Outflows
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Investor Payouts: {formatCurrency(month.totalInvestorPayouts)}
                  </Typography>
                  <Typography variant="body2" fontWeight="bold" color="error.main">
                    Total Out: {formatCurrency(month.totalInvestorPayouts)}
                  </Typography>
                </Box>

                <Divider sx={{ my: 1 }} />

                {/* NET Cashflow */}
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    📊 NET Cashflow
                  </Typography>
                  <Typography 
                    variant="h6" 
                    sx={{ 
                      color: month.netCashflow >= 0 ? 'success.main' : 'error.main',
                      fontWeight: 'bold'
                    }}
                  >
                    {formatCurrency(month.netCashflow)}
                  </Typography>
                  <Chip 
                    label={month.netCashflow >= 0 ? 'Positive' : 'Negative'} 
                    color={month.netCashflow >= 0 ? 'success' : 'error'} 
                    size="small"
                  />
                </Box>

                {/* Activity Indicators */}
                <Box>
                  {month.loanMaturies.length > 0 && (
                    <Typography variant="caption" color="warning.main" display="block">
                      🏦 {month.loanMaturies.length} loan(s) maturing
                    </Typography>
                  )}
                  {month.interestPayments.length > 0 && (
                    <Typography variant="caption" color="info.main" display="block">
                      💵 {month.interestPayments.length} interest payment(s)
                    </Typography>
                  )}
                  {month.investorPayouts.length > 0 && (
                    <Typography variant="caption" color="error.main" display="block">
                      👥 {month.investorPayouts.length} investor payout(s)
                    </Typography>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Formula Explanation */}
      <Card sx={{ mt: 3, bgcolor: 'grey.50' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            📈 Calculation Method
          </Typography>
          <Typography variant="body2" color="textSecondary">
            <strong>NET Cashflow</strong> = (Net Interest Income + Principal Repayments) - Investor Interest Payments
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            • <strong>Net Interest Income:</strong> Uses actual NET payment data (after taxes & fees) from borrowers<br/>
            • <strong>Calculation:</strong> (Actual NET Amount Paid ÷ Loan Term Months) for each active loan<br/>
            • <strong>Principal Repayments:</strong> Loan amounts due when loans mature<br/>
            • <strong>Investor Payments:</strong> Monthly interest payments to investors (individual rates)<br/>
            • <strong>Taxes & Fees:</strong> Tracked separately for transparency
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            <strong>🎯 Key Features:</strong>
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
            • Uses actual NET payment records (gross - taxes - fees)<br/>
            • Proper upfront interest calculation with daily proration<br/>
            • Only shows income from loans where borrowers actually paid<br/>
            • Spreads actual payments over the precise loan term<br/>
            • Separate tracking of taxes and fees for financial transparency<br/>
            • Collection rates shown for both gross and net amounts
          </Typography>
        </CardContent>
      </Card>
    </div>
  );
}

export default CashFlowTab;