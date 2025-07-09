const express = require('express');
const router = express.Router();
const db = require('../database/connection');
const { calculateUpfrontInterest } = require('../utils/calculations');

// Get monthly cashflow data with prediction
router.get('/monthly', async (req, res) => {
  try {
    console.log('💰 Fetching monthly cashflow data with actual payment data...');
    
    const months = parseInt(req.query.months) || 12;
    
    // Get active loans with actual payment data for cashflow prediction
    const activeLoans = await db.query(`
      SELECT 
        s.id,
        s.loan_amount,
        s.interest_rate as borrower_interest_rate,
        s.loan_start_date,
        s.loan_repayment_date,
        s.loan_expiry_date,
        p.name as project_title,
        p.id as project_id,
        COALESCE(payment_summary.total_interest_paid, 0) as total_interest_paid,
        COALESCE(payment_summary.payment_count, 0) as payment_count,
        payment_summary.last_payment_date
      FROM stage s
      LEFT JOIN project p ON s.project_id = p.id
      LEFT JOIN (
        SELECT 
          stage_id,
          SUM(money) as total_interest_paid,
          COUNT(*) as payment_count,
          MAX(date) as last_payment_date
        FROM invest_interest 
        GROUP BY stage_id
      ) payment_summary ON s.id = payment_summary.stage_id
      WHERE s.status IN ('operating', 'performing')
        AND (p.id IN (59, 55, 51) OR s.loan_repayment_date >= CURDATE())
    `);

    // Get investor funding for payout calculations
    const investorFunding = await db.query(`
      SELECT 
        inf.stage_id,
        inf.investor_id,
        inf.income_rate as investor_rate,
        inf.value as investment_amount,
        inf.start_date as investor_start_date,
        inf.end_date as investor_end_date,
        a.name as investor_name
      FROM invest_funding inf
      LEFT JOIN account a ON inf.investor_id = a.id
      WHERE inf.type = 'Investment'
        AND inf.income_rate IS NOT NULL
        AND inf.income_rate > 0
    `);

    const cashflowData = [];
    let totalInflows = 0;
    let totalOutflows = 0;

    // Pre-calculate loan data with proper upfront interest and actual payments
    const loanData = activeLoans.map(loan => {
      // Calculate proper expected upfront interest
      const expectedInterest = calculateUpfrontInterest(
        parseFloat(loan.loan_amount),
        loan.borrower_interest_rate,
        loan.loan_start_date,
        loan.loan_repayment_date
      );
      
      // Use actual payment amount (what borrower actually paid)
      const actualPaidAmount = parseFloat(loan.total_interest_paid || 0);
      
      // Calculate loan term in months for spreading the income
      const loanStartDate = new Date(loan.loan_start_date);
      const loanEndDate = new Date(loan.loan_repayment_date);
      const totalDays = Math.ceil((loanEndDate - loanStartDate) / (1000 * 60 * 60 * 24));
      const approximateMonths = Math.max(1, Math.round(totalDays / 30)); // Ensure at least 1 month
      
      // Calculate monthly income based on actual payments
      const monthlyIncomeFromActualPayments = actualPaidAmount / approximateMonths;
      
      return {
        ...loan,
        expectedInterest: expectedInterest.totalInterest,
        actualPaidAmount,
        approximateMonths,
        monthlyIncomeFromActualPayments,
        loanStartDate,
        loanEndDate,
        contractPeriod: expectedInterest.period
      };
    });

    console.log(`📊 Processing ${loanData.length} loans with actual payment data`);
    console.log(`💰 Total actual interest collected: $${loanData.reduce((sum, l) => sum + l.actualPaidAmount, 0).toFixed(2)}`);
    console.log(`📈 Total expected interest: $${loanData.reduce((sum, l) => sum + l.expectedInterest, 0).toFixed(2)}`);

    // Generate monthly predictions
    for (let i = 0; i < months; i++) {
      const targetDate = new Date();
      targetDate.setMonth(targetDate.getMonth() + i);
      const monthStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
      const monthEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
      
      const monthData = {
        month: targetDate.toISOString().slice(0, 7), // YYYY-MM format
        monthName: targetDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        totalInterestReceivable: 0,
        totalPrincipalDue: 0,
        totalCashInflow: 0,
        totalInvestorPayouts: 0,
        netCashflow: 0,
        loanMaturies: [],
        interestPayments: [],
        investorPayouts: []
      };

      // Calculate monthly interest income based on actual payments spread over loan term
      for (const loan of loanData) {
        // Check if loan is active during this month
        if (loan.loanStartDate <= monthEnd && loan.loanEndDate >= monthStart) {
          // Only include income if borrower actually made payments
          if (loan.actualPaidAmount > 0) {
            monthData.totalInterestReceivable += loan.monthlyIncomeFromActualPayments;
            monthData.interestPayments.push({
              stageId: loan.id,
              projectTitle: loan.project_title,
              amount: loan.monthlyIncomeFromActualPayments,
              type: 'actual_monthly_income',
              actualPaid: loan.actualPaidAmount,
              expectedTotal: loan.expectedInterest,
              paymentStatus: loan.actualPaidAmount >= loan.expectedInterest * 0.99 ? 'fully_paid' : 'partial_paid'
            });
          }
        }
        
        // Check if loan matures this month (principal due)
        if (loan.loanEndDate >= monthStart && loan.loanEndDate <= monthEnd) {
          monthData.totalPrincipalDue += parseFloat(loan.loan_amount);
          monthData.loanMaturies.push({
            stageId: loan.id,
            projectTitle: loan.project_title,
            amount: parseFloat(loan.loan_amount),
            maturityDate: loan.loanEndDate.toISOString().slice(0, 10)
          });
        }
      }

      // Calculate investor payouts for this month
      for (const investor of investorFunding) {
        const investorStartDate = new Date(investor.investor_start_date);
        const investorEndDate = new Date(investor.investor_end_date);
        
        // Check if investor should receive payment this month
        if (investorStartDate <= monthEnd && investorEndDate >= monthStart) {
          const monthlyRate = parseFloat(investor.investor_rate) / 12;
          const monthlyPayment = parseFloat(investor.investment_amount) * monthlyRate;
          
          monthData.totalInvestorPayouts += monthlyPayment;
          monthData.investorPayouts.push({
            investorId: investor.investor_id,
            investorName: investor.investor_name || `Investor ${investor.investor_id}`,
            stageId: investor.stage_id,
            amount: monthlyPayment
          });
        }
      }

      // Calculate totals and net cashflow
      monthData.totalCashInflow = monthData.totalInterestReceivable + monthData.totalPrincipalDue;
      monthData.netCashflow = monthData.totalCashInflow - monthData.totalInvestorPayouts;
      
      // Round all monetary values
      monthData.totalInterestReceivable = Math.round(monthData.totalInterestReceivable * 100) / 100;
      monthData.totalPrincipalDue = Math.round(monthData.totalPrincipalDue * 100) / 100;
      monthData.totalCashInflow = Math.round(monthData.totalCashInflow * 100) / 100;
      monthData.totalInvestorPayouts = Math.round(monthData.totalInvestorPayouts * 100) / 100;
      monthData.netCashflow = Math.round(monthData.netCashflow * 100) / 100;

      // Add to totals
      totalInflows += monthData.totalCashInflow;
      totalOutflows += monthData.totalInvestorPayouts;

      cashflowData.push(monthData);
    }

    // Calculate summary with actual payment statistics
    const loansWithPayments = loanData.filter(l => l.actualPaidAmount > 0);
    const fullyPaidLoans = loanData.filter(l => l.actualPaidAmount >= l.expectedInterest * 0.99);
    const partiallyPaidLoans = loanData.filter(l => l.actualPaidAmount > 0 && l.actualPaidAmount < l.expectedInterest * 0.99);
    const unpaidLoans = loanData.filter(l => l.actualPaidAmount === 0);

    const summary = {
      totalInflows: Math.round(totalInflows * 100) / 100,
      totalOutflows: Math.round(totalOutflows * 100) / 100,
      totalNetCashflow: Math.round((totalInflows - totalOutflows) * 100) / 100,
      investorDetails: {
        totalInvestors: [...new Set(investorFunding.map(inv => inv.investor_id))].length
      },
      paymentAnalysis: {
        totalLoans: loanData.length,
        loansWithPayments: loansWithPayments.length,
        fullyPaidLoans: fullyPaidLoans.length,
        partiallyPaidLoans: partiallyPaidLoans.length,
        unpaidLoans: unpaidLoans.length,
        totalActualPayments: Math.round(loanData.reduce((sum, l) => sum + l.actualPaidAmount, 0) * 100) / 100,
        totalExpectedPayments: Math.round(loanData.reduce((sum, l) => sum + l.expectedInterest, 0) * 100) / 100,
        collectionRate: loanData.reduce((sum, l) => sum + l.expectedInterest, 0) > 0 ? 
          Math.round((loanData.reduce((sum, l) => sum + l.actualPaidAmount, 0) / 
                     loanData.reduce((sum, l) => sum + l.expectedInterest, 0)) * 10000) / 100 : 0
      }
    };

    console.log(`✅ Generated ${months}-month cashflow prediction based on actual payments`);
    console.log(`💰 Total Inflows: $${summary.totalInflows.toFixed(2)}`);
    console.log(`💸 Total Outflows: $${summary.totalOutflows.toFixed(2)}`);
    console.log(`📊 NET Cashflow: $${summary.totalNetCashflow.toFixed(2)}`);
    console.log(`📈 Payment Analysis:`);
    console.log(`   - Loans with payments: ${summary.paymentAnalysis.loansWithPayments}/${summary.paymentAnalysis.totalLoans}`);
    console.log(`   - Collection rate: ${summary.paymentAnalysis.collectionRate}%`);

    res.json({
      success: true,
      data: cashflowData,
      summary: summary
    });
    
  } catch (error) {
    console.error('❌ Error fetching cashflow data:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching cashflow data',
      error: error.message
    });
  }
});

module.exports = router;