const express = require('express');
const router = express.Router();
const db = require('../database/connection');
const { calculateUpfrontInterest, generatePaymentSchedule, calculateBasePaymentDate } = require('../utils/calculations');

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
        COALESCE(payment_summary.total_interest_paid_gross, 0) as total_interest_paid_gross,
        COALESCE(payment_summary.total_interest_paid_net, 0) as total_interest_paid_net,
        COALESCE(payment_summary.total_tax_paid, 0) as total_tax_paid,
        COALESCE(payment_summary.total_fees_paid, 0) as total_fees_paid,
        COALESCE(payment_summary.payment_count, 0) as payment_count,
        payment_summary.last_payment_date
      FROM stage s
      LEFT JOIN project p ON s.project_id = p.id
      LEFT JOIN (
        SELECT 
          stage_id,
          SUM(money) as total_interest_paid_gross,
          SUM(net) as total_interest_paid_net,
          SUM(tax) as total_tax_paid,
          SUM(fee) as total_fees_paid,
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
      
      // Use actual payment amounts (gross vs net)
      const actualPaidGross = parseFloat(loan.total_interest_paid_gross || 0);
      const actualPaidNet = parseFloat(loan.total_interest_paid_net || 0);
      const totalTaxPaid = parseFloat(loan.total_tax_paid || 0);
      const totalFeesPaid = parseFloat(loan.total_fees_paid || 0);
      
      const loanStartDate = new Date(loan.loan_start_date);
      const loanEndDate = new Date(loan.loan_repayment_date);
      
      // Generate payment schedule for borrower interest income (same logic as investors)
      const predictionEndDate = new Date();
      predictionEndDate.setMonth(predictionEndDate.getMonth() + months);
      
      const basePaymentDate = calculateBasePaymentDate(
        loan.last_payment_date,
        loan.loan_start_date,
        null // No transaction date for borrowers
      );
      
      const borrowerPaymentSchedule = generatePaymentSchedule(
        basePaymentDate,
        loan.loan_repayment_date,
        predictionEndDate,
        !!loan.last_payment_date
      );
      
      // Calculate monthly interest rate for borrower
      const borrowerMonthlyRate = parseFloat(loan.borrower_interest_rate) / 12;
      const loanAmount = parseFloat(loan.loan_amount);
      
      return {
        ...loan,
        expectedInterest: expectedInterest.totalInterest,
        actualPaidGross,
        actualPaidNet,
        totalTaxPaid,
        totalFeesPaid,
        loanStartDate,
        loanEndDate,
        contractPeriod: expectedInterest.period,
        borrowerPaymentSchedule,
        borrowerMonthlyRate,
        loanAmount
      };
    });

    console.log(`📊 Processing ${loanData.length} loans with actual payment data`);
    console.log(`💰 Total actual interest collected (GROSS): $${loanData.reduce((sum, l) => sum + l.actualPaidGross, 0).toFixed(2)}`);
    console.log(`💰 Total actual interest collected (NET): $${loanData.reduce((sum, l) => sum + l.actualPaidNet, 0).toFixed(2)}`);
    console.log(`💸 Total taxes paid: $${loanData.reduce((sum, l) => sum + l.totalTaxPaid, 0).toFixed(2)}`);
    console.log(`💸 Total fees paid: $${loanData.reduce((sum, l) => sum + l.totalFeesPaid, 0).toFixed(2)}`);
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
        totalTaxes: 0,
        totalFees: 0,
        totalPrincipalDue: 0,
        totalCashInflow: 0,
        totalInvestorPayouts: 0,
        netCashflow: 0,
        loanMaturies: [],
        interestPayments: [],
        investorPayouts: []
      };

      // Calculate monthly interest income based on payment schedule (same logic as investors)
      for (const loan of loanData) {
        // Check if loan is active during this month
        if (loan.loanStartDate <= monthEnd && loan.loanEndDate >= monthStart) {
          // Only include income if borrower actually made payments
          if (loan.actualPaidNet > 0) {
            // Check if this month has a scheduled payment for the borrower
            const hasPaymentThisMonth = loan.borrowerPaymentSchedule.some(paymentDate => 
              paymentDate >= monthStart && paymentDate <= monthEnd
            );
            
            if (hasPaymentThisMonth) {
              // Calculate payment amount using the same logic as investors
              let monthlyInterestAmount = loan.loanAmount * loan.borrowerMonthlyRate;
              
              // Check if this is the final month and needs prorating
              const isLastMonth = loan.loanEndDate >= monthStart && loan.loanEndDate <= monthEnd;
              
              if (isLastMonth) {
                // Calculate prorated amount for final month
                const finalPaymentDate = loan.borrowerPaymentSchedule.find(paymentDate => 
                  paymentDate >= monthStart && paymentDate <= monthEnd
                );
                
                if (finalPaymentDate) {
                  const daysInMonth = new Date(monthEnd.getFullYear(), monthEnd.getMonth() + 1, 0).getDate();
                  const actualDaysInMonth = Math.min(
                    Math.ceil((loan.loanEndDate - monthStart) / (1000 * 60 * 60 * 24)),
                    daysInMonth
                  );
                  
                  // Prorate: ((borrower's annual rate / 12) / (days in month)) * actual days
                  const dailyRate = loan.borrowerMonthlyRate / daysInMonth;
                  monthlyInterestAmount = loan.loanAmount * dailyRate * actualDaysInMonth;
                  
                  console.log(`📅 Prorated final month interest for loan ${loan.id}:`);
                  console.log(`   Monthly rate: ${loan.borrowerMonthlyRate.toFixed(6)}`);
                  console.log(`   Days in month: ${daysInMonth}`);
                  console.log(`   Actual days in month: ${actualDaysInMonth}`);
                  console.log(`   Daily rate: ${dailyRate.toFixed(8)}`);
                  console.log(`   Standard monthly: $${(loan.loanAmount * loan.borrowerMonthlyRate).toFixed(2)}`);
                  console.log(`   Prorated amount: $${monthlyInterestAmount.toFixed(2)}`);
                }
              }
              
              // Calculate proportional amounts for taxes and fees based on actual payments
              const grossToNetRatio = loan.actualPaidNet / (loan.actualPaidGross || 1);
              const taxRatio = loan.totalTaxPaid / (loan.actualPaidGross || 1);
              const feeRatio = loan.totalFeesPaid / (loan.actualPaidGross || 1);
              
              const grossAmount = monthlyInterestAmount;
              const netAmount = grossAmount * grossToNetRatio;
              const taxAmount = grossAmount * taxRatio;
              const feeAmount = grossAmount * feeRatio;
              
              monthData.totalInterestReceivable += netAmount;
              monthData.totalTaxes += taxAmount;
              monthData.totalFees += feeAmount;
              
              monthData.interestPayments.push({
                stageId: loan.id,
                projectTitle: loan.project_title,
                netAmount: netAmount,
                grossAmount: grossAmount,
                taxAmount: taxAmount,
                feeAmount: feeAmount,
                type: 'scheduled_monthly_income',
                actualPaidGross: loan.actualPaidGross,
                actualPaidNet: loan.actualPaidNet,
                totalTaxes: loan.totalTaxPaid,
                totalFees: loan.totalFeesPaid,
                expectedTotal: loan.expectedInterest,
                paymentStatus: loan.actualPaidNet >= loan.expectedInterest * 0.99 ? 'fully_paid' : 'partial_paid',
                isProrated: isLastMonth,
                scheduledPaymentDate: loan.borrowerPaymentSchedule.find(paymentDate => 
                  paymentDate >= monthStart && paymentDate <= monthEnd
                )?.toISOString().slice(0, 10)
              });
            }
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
          
          const investorName = investor.investor_name || `Investor ${investor.investor_id}`;
          const isGoodlandInvestor = investorName.toLowerCase().includes('goodland');
          
          // Only add to cash outflows if not a Goodland investor
          if (!isGoodlandInvestor) {
            monthData.totalInvestorPayouts += monthlyPayment;
          }
          
          monthData.investorPayouts.push({
            investorId: investor.investor_id,
            investorName: investorName,
            stageId: investor.stage_id,
            amount: monthlyPayment,
            isGoodlandInvestor: isGoodlandInvestor,
            excludedFromOutflows: isGoodlandInvestor
          });
        }
      }

      // Calculate totals and net cashflow
      monthData.totalCashInflow = monthData.totalInterestReceivable + monthData.totalPrincipalDue;
      monthData.netCashflow = monthData.totalCashInflow - monthData.totalInvestorPayouts;
      
      // Round all monetary values
      monthData.totalInterestReceivable = Math.round(monthData.totalInterestReceivable * 100) / 100;
      monthData.totalTaxes = Math.round(monthData.totalTaxes * 100) / 100;
      monthData.totalFees = Math.round(monthData.totalFees * 100) / 100;
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
    const loansWithPayments = loanData.filter(l => l.actualPaidNet > 0);
    const fullyPaidLoans = loanData.filter(l => l.actualPaidNet >= l.expectedInterest * 0.99);
    const partiallyPaidLoans = loanData.filter(l => l.actualPaidNet > 0 && l.actualPaidNet < l.expectedInterest * 0.99);
    const unpaidLoans = loanData.filter(l => l.actualPaidNet === 0);

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
        totalActualPaymentsGross: Math.round(loanData.reduce((sum, l) => sum + l.actualPaidGross, 0) * 100) / 100,
        totalActualPaymentsNet: Math.round(loanData.reduce((sum, l) => sum + l.actualPaidNet, 0) * 100) / 100,
        totalTaxesPaid: Math.round(loanData.reduce((sum, l) => sum + l.totalTaxPaid, 0) * 100) / 100,
        totalFeesPaid: Math.round(loanData.reduce((sum, l) => sum + l.totalFeesPaid, 0) * 100) / 100,
        totalExpectedPayments: Math.round(loanData.reduce((sum, l) => sum + l.expectedInterest, 0) * 100) / 100,
        collectionRateGross: loanData.reduce((sum, l) => sum + l.expectedInterest, 0) > 0 ? 
          Math.round((loanData.reduce((sum, l) => sum + l.actualPaidGross, 0) / 
                     loanData.reduce((sum, l) => sum + l.expectedInterest, 0)) * 10000) / 100 : 0,
        collectionRateNet: loanData.reduce((sum, l) => sum + l.expectedInterest, 0) > 0 ? 
          Math.round((loanData.reduce((sum, l) => sum + l.actualPaidNet, 0) / 
                     loanData.reduce((sum, l) => sum + l.expectedInterest, 0)) * 10000) / 100 : 0
      }
    };

    console.log(`✅ Generated ${months}-month cashflow prediction based on actual payments`);
    console.log(`💰 Total Inflows: $${summary.totalInflows.toFixed(2)}`);
    console.log(`💸 Total Outflows: $${summary.totalOutflows.toFixed(2)}`);
    console.log(`📊 NET Cashflow: $${summary.totalNetCashflow.toFixed(2)}`);
    console.log(`📈 Payment Analysis:`);
    console.log(`   - Loans with payments: ${summary.paymentAnalysis.loansWithPayments}/${summary.paymentAnalysis.totalLoans}`);
    console.log(`   - Collection rate (Gross): ${summary.paymentAnalysis.collectionRateGross}%`);
    console.log(`   - Collection rate (Net): ${summary.paymentAnalysis.collectionRateNet}%`);

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