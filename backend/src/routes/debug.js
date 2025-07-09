const express = require('express');
const router = express.Router();
const db = require('../database/connection');
const {
  calculateUpfrontInterest,
  getUpfrontInterestStatus,
  getLoanStatus,
  calculateBasePaymentDate,
  generatePaymentSchedule,
  isPaymentDueInMonth
} = require('../utils/calculations');

// Debug endpoint to investigate payment date synchronization issues
router.get('/payment-sync/:projectName', async (req, res) => {
  try {
    const projectName = req.params.projectName;
    console.log(`🔍 Investigating payment synchronization for project: ${projectName}`);
    
    // Find the project
    const projects = await db.query(`
      SELECT id, name 
      FROM project 
      WHERE name LIKE '%${projectName}%'
    `);
    
    if (projects.length === 0) {
      return res.json({ success: false, message: 'Project not found' });
    }
    
    const project = projects[0];
    
    // Get all investor funding for this project with detailed payment information
    const investors = await db.query(`
      SELECT 
        inf.id as funding_id,
        inf.stage_id,
        inf.investor_id,
        inf.income_rate,
        inf.value as investment_amount,
        inf.start_date as investor_start_date,
        inf.end_date as investor_end_date,
        inf.transcation_date,
        a.name as investor_name,
        s.loan_start_date as project_start_date,
        s.loan_repayment_date as project_end_date,
        (SELECT MAX(ii.date) 
         FROM invest_interest ii 
         WHERE ii.stage_id = inf.stage_id 
           AND ii.investor_id = inf.investor_id) as last_payment_date,
        (SELECT COUNT(ii.id) 
         FROM invest_interest ii 
         WHERE ii.stage_id = inf.stage_id 
           AND ii.investor_id = inf.investor_id) as payment_count,
        (SELECT GROUP_CONCAT(CONCAT(ii.date, ':', ii.money) ORDER BY ii.date) 
         FROM invest_interest ii 
         WHERE ii.stage_id = inf.stage_id 
           AND ii.investor_id = inf.investor_id) as payment_history
      FROM invest_funding inf
      JOIN stage s ON inf.stage_id = s.id
      LEFT JOIN account a ON inf.investor_id = a.id
      WHERE s.project_id = ?
        AND inf.type = 'Investment'
        AND inf.income_rate IS NOT NULL
        AND inf.income_rate > 0
      ORDER BY a.name, inf.value DESC
    `, [project.id]);
    
    // Calculate payment schedules for each investor
    const investorAnalysis = investors.map(inv => {
      // Apply the same logic as the main payment calculation
      let basePaymentDate;
      if (inv.last_payment_date) {
        basePaymentDate = new Date(inv.last_payment_date);
      } else {
        const transDate = inv.transcation_date ? new Date(inv.transcation_date) : null;
        const startDate = new Date(inv.investor_start_date);
        basePaymentDate = (transDate && transDate > startDate) ? transDate : startDate;
      }
      
      // Calculate next payment date using the same logic as generatePaymentSchedule
      let nextPaymentDate = new Date(basePaymentDate);
      if (inv.last_payment_date) {
        // Next payment = last payment + 1 month - 1 day
        nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
        nextPaymentDate.setDate(nextPaymentDate.getDate() - 1);
      }
      
      return {
        investorName: inv.investor_name,
        investorId: inv.investor_id,
        investmentAmount: parseFloat(inv.investment_amount),
        stageId: inv.stage_id,
        dates: {
          investorStartDate: inv.investor_start_date,
          transactionDate: inv.transcation_date,
          projectStartDate: inv.project_start_date,
          lastPaymentDate: inv.last_payment_date,
          calculatedBaseDate: basePaymentDate.toISOString().slice(0, 10),
          nextPaymentDate: nextPaymentDate.toISOString().slice(0, 10)
        },
        paymentHistory: {
          count: inv.payment_count,
          history: inv.payment_history
        },
        analysis: {
          hasLastPayment: !!inv.last_payment_date,
          usesTransactionDate: inv.transcation_date && new Date(inv.transcation_date) > new Date(inv.investor_start_date),
          daysSinceProjectStart: Math.ceil((new Date() - new Date(inv.project_start_date)) / (1000 * 60 * 60 * 24))
        }
      };
    });
    
    // Group by next payment date to identify synchronization issues
    const paymentDateGroups = {};
    investorAnalysis.forEach(inv => {
      const nextDate = inv.dates.nextPaymentDate;
      if (!paymentDateGroups[nextDate]) {
        paymentDateGroups[nextDate] = [];
      }
      paymentDateGroups[nextDate].push(inv.investorName);
    });
    
    // Identify potential issues
    const issues = [];
    const uniquePaymentDates = Object.keys(paymentDateGroups);
    
    if (uniquePaymentDates.length > 1) {
      issues.push({
        type: 'UNSYNCHRONIZED_PAYMENTS',
        description: 'Investors have different next payment dates',
        details: paymentDateGroups
      });
    }
    
    // Check for different transaction dates
    const transactionDates = [...new Set(investorAnalysis.map(inv => inv.dates.transactionDate).filter(Boolean))];
    if (transactionDates.length > 1) {
      issues.push({
        type: 'DIFFERENT_TRANSACTION_DATES',
        description: 'Investors have different transaction dates',
        details: transactionDates
      });
    }
    
    // Check for different start dates
    const startDates = [...new Set(investorAnalysis.map(inv => inv.dates.investorStartDate))];
    if (startDates.length > 1) {
      issues.push({
        type: 'DIFFERENT_START_DATES',
        description: 'Investors have different start dates',
        details: startDates
      });
    }
    
    res.json({
      success: true,
      project: {
        id: project.id,
        name: project.name
      },
      investorCount: investors.length,
      paymentDateGroups: paymentDateGroups,
      issues: issues,
      investorAnalysis: investorAnalysis,
      summary: {
        uniquePaymentDates: uniquePaymentDates.length,
        syncedPayments: uniquePaymentDates.length === 1,
        earliestPayment: Math.min(...uniquePaymentDates.map(d => new Date(d))),
        latestPayment: Math.max(...uniquePaymentDates.map(d => new Date(d))),
        daysBetweenEarliestLatest: uniquePaymentDates.length > 1 ? 
          Math.ceil((Math.max(...uniquePaymentDates.map(d => new Date(d))) - Math.min(...uniquePaymentDates.map(d => new Date(d)))) / (1000 * 60 * 60 * 24)) : 0
      }
    });
    
  } catch (error) {
    console.error('❌ Error in payment sync debug endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Error investigating payment synchronization',
      error: error.message
    });
  }
});

// Debug endpoint to test prorated payment calculations
router.get('/prorated-payments/:stageId/:investorId', async (req, res) => {
  try {
    const { stageId, investorId } = req.params;
    console.log(`🧪 Testing prorated payment calculation for Stage ${stageId}, Investor ${investorId}`);
    
    // Get investor funding details
    const investor = await db.query(`
      SELECT 
        inf.id as funding_id,
        inf.stage_id,
        inf.investor_id,
        inf.income_rate as investor_rate,
        inf.value as investment_amount,
        inf.start_date as investor_start_date,
        inf.end_date as investor_end_date,
        inf.transcation_date,
        a.name as investor_name,
        (SELECT MAX(ii.date) 
         FROM invest_interest ii 
         WHERE ii.stage_id = inf.stage_id 
           AND ii.investor_id = inf.investor_id) as last_payment_date
      FROM invest_funding inf
      LEFT JOIN account a ON inf.investor_id = a.id
      WHERE inf.stage_id = ? AND inf.investor_id = ?
        AND inf.type = 'Investment'
    `, [stageId, investorId]);
    
    if (investor.length === 0) {
      return res.json({ success: false, message: 'Investor funding not found' });
    }
    
    const investorData = investor[0];
    const investmentEndDate = new Date(investorData.investor_end_date);
    const lastPaymentDate = investorData.last_payment_date ? 
      new Date(investorData.last_payment_date) : 
      new Date(investorData.investor_start_date);
    
    // Calculate various scenarios
    const scenarios = [];
    
    // Scenario 1: Normal monthly payment
    const monthlyRate = parseFloat(investorData.investor_rate) / 12;
    const standardMonthlyPayment = parseFloat(investorData.investment_amount) * monthlyRate;
    
    scenarios.push({
      scenario: 'Standard Monthly Payment',
      paymentAmount: standardMonthlyPayment,
      calculation: {
        investmentAmount: parseFloat(investorData.investment_amount),
        annualRate: parseFloat(investorData.investor_rate),
        monthlyRate: monthlyRate,
        formula: 'Investment Amount × (Annual Rate ÷ 12)'
      }
    });
    
    // Scenario 2: Calculate remaining days from last payment to end
    const remainingDays = Math.ceil((investmentEndDate - lastPaymentDate) / (1000 * 60 * 60 * 24));
    
    if (remainingDays < 30) {
      const daysInFinalMonth = new Date(investmentEndDate.getFullYear(), investmentEndDate.getMonth() + 1, 0).getDate();
      const dailyRate = monthlyRate / daysInFinalMonth;
      const proratedPayment = parseFloat(investorData.investment_amount) * dailyRate * remainingDays;
      
      scenarios.push({
        scenario: 'Prorated Final Payment',
        paymentAmount: proratedPayment,
        calculation: {
          investmentAmount: parseFloat(investorData.investment_amount),
          annualRate: parseFloat(investorData.investor_rate),
          monthlyRate: monthlyRate,
          daysInFinalMonth: daysInFinalMonth,
          dailyRate: dailyRate,
          remainingDays: remainingDays,
          formula: 'Investment Amount × (Monthly Rate ÷ Days in Month) × Remaining Days'
        }
      });
    }
    
    // Scenario 3: Test different remaining day scenarios
    [7, 15, 25, 30, 35].forEach(testDays => {
      const testEndDate = new Date(lastPaymentDate);
      testEndDate.setDate(testEndDate.getDate() + testDays);
      
      const testDaysInMonth = new Date(testEndDate.getFullYear(), testEndDate.getMonth() + 1, 0).getDate();
      const testDailyRate = monthlyRate / testDaysInMonth;
      const testProratedPayment = testDays < 30 ? 
        parseFloat(investorData.investment_amount) * testDailyRate * testDays :
        standardMonthlyPayment;
      
      scenarios.push({
        scenario: `Test: ${testDays} days remaining`,
        paymentAmount: testProratedPayment,
        isProrated: testDays < 30,
        calculation: {
          testDays: testDays,
          daysInMonth: testDaysInMonth,
          dailyRate: testDailyRate,
          usesProration: testDays < 30
        }
      });
    });
    
    res.json({
      success: true,
      investorData: {
        stageId: investorData.stage_id,
        investorId: investorData.investor_id,
        investorName: investorData.investor_name,
        investmentAmount: parseFloat(investorData.investment_amount),
        annualRate: parseFloat(investorData.investor_rate) * 100,
        investmentStartDate: investorData.investor_start_date,
        investmentEndDate: investorData.investor_end_date,
        lastPaymentDate: investorData.last_payment_date,
        remainingDays: remainingDays
      },
      scenarios: scenarios,
      debug: {
        currentDate: new Date().toISOString().slice(0, 10),
        endDate: investmentEndDate.toISOString().slice(0, 10),
        lastPaymentUsed: lastPaymentDate.toISOString().slice(0, 10),
        daysBetween: remainingDays,
        shouldProrate: remainingDays < 30
      }
    });
    
  } catch (error) {
    console.error('❌ Error in prorated payment debug endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Error testing prorated payments',
      error: error.message
    });
  }
});

// Debug endpoint to check for duplicate project names and missing records
router.get('/duplicates/:projectName', async (req, res) => {
  try {
    const projectName = req.params.projectName;
    console.log(`🔍 Checking for duplicate/missing records for: ${projectName}`);
    
    // Get ALL records for this project name (no filters)
    const allRecordsQuery = `
      SELECT 
        s.id as stage_id,
        s.status as stage_status,
        s.loan_amount,
        s.loan_start_date,
        s.loan_repayment_date,
        s.loan_expiry_date,
        p.name as project_title,
        p.id as project_id,
        DATEDIFF(s.loan_repayment_date, CURDATE()) as days_to_maturity,
        'ALL_RECORDS' as query_type
      FROM stage s
      LEFT JOIN project p ON s.project_id = p.id
      WHERE p.name LIKE '%${projectName}%'
      ORDER BY s.id ASC
    `;
    
    // Get records that match the main API criteria
    const filteredRecordsQuery = `
      SELECT 
        s.id as stage_id,
        s.status as stage_status,
        s.loan_amount,
        s.loan_start_date,
        s.loan_repayment_date,
        s.loan_expiry_date,
        p.name as project_title,
        p.id as project_id,
        DATEDIFF(s.loan_repayment_date, CURDATE()) as days_to_maturity,
        'FILTERED_RECORDS' as query_type
      FROM stage s
      LEFT JOIN project p ON s.project_id = p.id
      WHERE p.name LIKE '%${projectName}%'
        AND s.status = 'operating'
        AND (p.id IN (59, 55, 51) OR s.loan_repayment_date >= CURDATE())
      ORDER BY s.id ASC
    `;
    
    const allRecords = await db.query(allRecordsQuery);
    const filteredRecords = await db.query(filteredRecordsQuery);
    
    res.json({
      success: true,
      projectName: projectName,
      allRecords: allRecords,
      filteredRecords: filteredRecords,
      summary: {
        totalRecords: allRecords.length,
        filteredRecords: filteredRecords.length,
        excludedRecords: allRecords.length - filteredRecords.length
      }
    });
    
  } catch (error) {
    console.error('❌ Error in duplicates debug endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking duplicate records',
      error: error.message
    });
  }
});

// Debug endpoint for specific loans
router.get('/loans/:projectTitle', async (req, res) => {
  try {
    const projectTitle = req.params.projectTitle;
    console.log(`🔍 Debugging loan for project: ${projectTitle}`);
    
    const query = `
      SELECT 
        s.id,
        s.loan_amount,
        s.interest_rate as borrower_interest_rate,
        s.default_rate,
        s.loan_start_date,
        s.loan_repayment_date,
        s.loan_expiry_date,
        s.status,
        p.name as project_title,
        p.status as project_status,
        p.id as project_id,
        DATEDIFF(s.loan_repayment_date, CURDATE()) as days_to_maturity,
        DATEDIFF(s.loan_start_date, CURDATE()) as days_to_start,
        (SELECT SUM(ii.money) 
         FROM invest_interest ii 
         WHERE ii.stage_id = s.id) as total_interest_paid,
        (SELECT MAX(ii.date) 
         FROM invest_interest ii 
         WHERE ii.stage_id = s.id) as last_payment_date,
        (SELECT COUNT(ii.id) 
         FROM invest_interest ii 
         WHERE ii.stage_id = s.id) as payment_count
      FROM stage s
      LEFT JOIN project p ON s.project_id = p.id
      WHERE p.name LIKE '%${projectTitle}%'
      ORDER BY s.loan_repayment_date ASC
    `;
    
    const loans = await db.query(query);
    
    if (loans.length === 0) {
      return res.json({ success: false, message: 'No loans found for this project' });
    }
    
    const debugResults = loans.map(loan => {
      const currentDate = new Date();
      const startDate = new Date(loan.loan_start_date);
      const endDate = new Date(loan.loan_repayment_date);
      const expireDate = new Date(loan.loan_expiry_date);
      
      // Calculate expected interest
      const expectedInterest = calculateUpfrontInterest(
        parseFloat(loan.loan_amount),
        loan.borrower_interest_rate,
        loan.loan_start_date,
        loan.loan_repayment_date
      );
      
      const actualPaidAmount = parseFloat(loan.total_interest_paid || 0);
      
      // Debug the interest status calculation step by step
      let debugInfo = {
        basicInfo: {
          id: loan.id,
          projectId: loan.project_id,
          projectTitle: loan.project_title,
          loanAmount: loan.loan_amount,
          borrowerRate: loan.borrower_interest_rate * 100
        },
        dates: {
          currentDate: currentDate.toISOString().slice(0, 10),
          startDate: loan.loan_start_date,
          repaymentDate: loan.loan_repayment_date,
          expiryDate: loan.loan_expiry_date,
          startInFuture: currentDate < startDate,
          repaymentInPast: endDate < currentDate,
          expiryInPast: expireDate < currentDate,
          expiryBeforeRepayment: expireDate < endDate
        },
        payments: {
          expectedInterest: expectedInterest.totalInterest,
          actualPaid: actualPaidAmount,
          paymentCount: loan.payment_count,
          paymentPercentage: expectedInterest.totalInterest > 0 ? 
            (actualPaidAmount / expectedInterest.totalInterest * 100) : 0
        },
        statusLogic: {
          isSpecialProject: [59, 55, 51].includes(loan.project_id)
        }
      };
      
      // Apply the same logic as the main function
      let interestStatus = 'unknown';
      let statusReason = '';
      
      if ([59, 55, 51].includes(loan.project_id)) {
        if (endDate < currentDate) {
          interestStatus = 'overdue';
          statusReason = 'Special project: repayment date passed';
        } else if (expireDate < endDate) {
          interestStatus = 'overdue-extension';
          statusReason = 'Special project: expiry date before repayment date';
        } else {
          statusReason = 'Special project: using normal logic';
        }
      }
      
      if (interestStatus === 'unknown') {
        if (currentDate < startDate) {
          interestStatus = 'pending';
          statusReason = 'Contract not started yet';
        } else if (!actualPaidAmount || actualPaidAmount === 0) {
          interestStatus = 'overdue';
          statusReason = 'No payment made after contract start';
        } else {
          const tolerance = expectedInterest.totalInterest * 0.01;
          if (actualPaidAmount >= (expectedInterest.totalInterest - tolerance)) {
            interestStatus = 'paid';
            statusReason = 'Sufficient payment made (>= 99%)';
          } else {
            interestStatus = 'partial';
            statusReason = 'Partial payment made';
          }
        }
      }
      
      debugInfo.result = {
        interestStatus,
        statusReason,
        tolerance: expectedInterest.totalInterest * 0.01,
        requiredForPaid: expectedInterest.totalInterest - (expectedInterest.totalInterest * 0.01)
      };
      
      return debugInfo;
    });
    
    res.json({
      success: true,
      results: debugResults
    });
    
  } catch (error) {
    console.error('❌ Error in debug endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Error debugging loans',
      error: error.message
    });
  }
});

module.exports = router; 