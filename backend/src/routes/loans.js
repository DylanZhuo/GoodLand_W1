const express = require('express');
const router = express.Router();
const db = require('../database/connection');
const {
  calculateUpfrontInterest,
  getUpfrontInterestStatus,
  getLoanStatus
} = require('../utils/calculations');

// Get loans with separate interest status and loan status
router.get('/', async (req, res) => {
  try {
    console.log('📊 Fetching loan data from database...');
    
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
      WHERE s.status IN ('operating', 'performing')
        AND (p.id IN (59, 55, 51) OR s.loan_repayment_date >= CURDATE())
      ORDER BY s.loan_repayment_date ASC
    `;
    
    const loans = await db.query(query);
    
    // Process loans and calculate statuses using upfront payment model
    const processedLoans = loans.map(loan => {
      const currentDate = new Date();
      
      // Calculate expected upfront interest amount using borrower's rate
      const expectedInterest = calculateUpfrontInterest(
        parseFloat(loan.loan_amount),
        loan.borrower_interest_rate, // Use borrower's rate, not lender's
        loan.loan_start_date,
        loan.loan_repayment_date
      );
      
      // Determine interest payment status (upfront model)
      const actualPaidAmount = parseFloat(loan.total_interest_paid || 0);
      const interestStatus = getUpfrontInterestStatus(
        expectedInterest.totalInterest,
        actualPaidAmount,
        loan.loan_start_date,
        loan.project_id,
        loan.loan_repayment_date,
        loan.loan_expiry_date
      );
      
      // Debug specific problematic loans
      if (loan.project_title && (
        loan.project_title.includes('Vediks') || 
        loan.project_title.includes('Sorelle Holdings') ||
        interestStatus === 'overdue'
      )) {
        console.log(`🔍 DEBUGGING INTEREST STATUS for ${loan.project_title}:`);
        console.log(`   Project ID: ${loan.project_id}`);
        console.log(`   Start Date: ${loan.loan_start_date}`);
        console.log(`   Current Date: ${new Date().toISOString().slice(0, 10)}`);
        console.log(`   Expected Interest: $${expectedInterest.totalInterest.toFixed(2)}`);
        console.log(`   Actual Paid: $${actualPaidAmount.toFixed(2)}`);
        console.log(`   Payment Count: ${loan.payment_count}`);
        console.log(`   Interest Status: ${interestStatus}`);
        console.log(`   Is Special Project: ${[59, 55, 51].includes(loan.project_id)}`);
        
        if (actualPaidAmount > 0) {
          const paymentPercentage = (actualPaidAmount / expectedInterest.totalInterest) * 100;
          console.log(`   Payment Completion: ${paymentPercentage.toFixed(2)}%`);
          
          const tolerance = expectedInterest.totalInterest * 0.01;
          console.log(`   Tolerance: $${tolerance.toFixed(2)}`);
          console.log(`   Sufficient Payment (>=95%): ${actualPaidAmount >= (expectedInterest.totalInterest - tolerance)}`);
        }
        console.log('   ---');
      }
      
      // Calculate loan status with proper overdue logic for special projects
      const loanStatus = getLoanStatus(
        loan.project_id, 
        loan.loan_start_date, 
        loan.loan_repayment_date, 
        loan.days_to_maturity,
        loan.loan_expiry_date
      );
      
      return {
        ...loan,
        // Interest rates (convert decimals to percentages)
        borrower_interest_rate: loan.borrower_interest_rate * 100,
        default_rate: loan.default_rate * 100,
        annual_interest_rate: loan.borrower_interest_rate * 100, // For compatibility
        interest_rate: loan.borrower_interest_rate * 100, // For compatibility
        
        // Dates (for compatibility)
        start_date: loan.loan_start_date,
        end_date: loan.loan_repayment_date,
        
        // Interest calculation details
        expected_total_interest: Math.round(expectedInterest.totalInterest * 100) / 100,
        expected_full_months_interest: Math.round(expectedInterest.fullMonthsInterest * 100) / 100,
        expected_partial_month_interest: Math.round(expectedInterest.partialMonthInterest * 100) / 100,
        contract_full_months: expectedInterest.period.fullMonths,
        contract_remaining_days: expectedInterest.period.remainingDays,
        
        // Payment status
        total_interest_paid: parseFloat(loan.total_interest_paid || 0),
        payment_count: loan.payment_count || 0,
        last_payment_date: loan.last_payment_date,
        interest_status: interestStatus,
        loan_status: loanStatus,
        
        // Payment completion percentage
        payment_completion: loan.total_interest_paid ? 
          Math.round((parseFloat(loan.total_interest_paid) / expectedInterest.totalInterest) * 100) : 0
      };
    });
    
    console.log(`✅ Found ${processedLoans.length} loans with upfront interest payment model`);
    
    // Debug: Check for duplicate project names (dirty data)
    const projectTitleCounts = {};
    processedLoans.forEach(loan => {
      const title = loan.project_title;
      if (!projectTitleCounts[title]) {
        projectTitleCounts[title] = [];
      }
      projectTitleCounts[title].push({
        stageId: loan.id,
        amount: loan.loan_amount,
        startDate: loan.loan_start_date,
        interestStatus: loan.interest_status
      });
    });
    
    // Log duplicate project names
    Object.keys(projectTitleCounts).forEach(title => {
      if (projectTitleCounts[title].length > 1) {
        console.log(`🔍 DUPLICATE PROJECT NAME "${title}":`);
        projectTitleCounts[title].forEach(loan => {
          console.log(`   Stage ID: ${loan.stageId}, Amount: $${loan.amount}, Start: ${loan.startDate}, Interest: ${loan.interestStatus}`);
    });
  }
});

    // Special projects debugging
    const specialProjects = processedLoans.filter(l => [59, 55, 51].includes(l.project_id));
    if (specialProjects.length > 0) {
      console.log(`🔍 SPECIAL PROJECTS (59, 55, 51) STATUS:`);
      specialProjects.forEach(loan => {
        console.log(`   Project ${loan.project_id} (${loan.project_title}):`);
        console.log(`     Repayment Date: ${loan.loan_repayment_date}`);
        console.log(`     Expiry Date: ${loan.loan_expiry_date}`);
        console.log(`     Interest Status: ${loan.interest_status}`);
        console.log(`     Loan Status: ${loan.loan_status}`);
      });
    }
    
    console.log(`📊 Upfront Interest Payment Summary:`);
    console.log(`   - Loans with payments made: ${processedLoans.filter(l => l.payment_count > 0).length}`);
    console.log(`   - Loans with no payments: ${processedLoans.filter(l => l.payment_count === 0).length}`);
    console.log(`   - Fully paid loans: ${processedLoans.filter(l => l.interest_status === 'paid').length}`);
    console.log(`   - Interest status breakdown:`, {
      paid: processedLoans.filter(l => l.interest_status === 'paid').length,
      partial: processedLoans.filter(l => l.interest_status === 'partial').length,
      overdue: processedLoans.filter(l => l.interest_status === 'overdue').length,
      'overdue-extension': processedLoans.filter(l => l.interest_status === 'overdue-extension').length,
      pending: processedLoans.filter(l => l.interest_status === 'pending').length
    });
    console.log(`   - Loan status breakdown:`, {
      active: processedLoans.filter(l => l.loan_status === 'active').length,
      overdue: processedLoans.filter(l => l.loan_status === 'overdue').length,
      'overdue-extension': processedLoans.filter(l => l.loan_status === 'overdue-extension').length,
      completed: processedLoans.filter(l => l.loan_status === 'completed').length,
      pending: processedLoans.filter(l => l.loan_status === 'pending').length
    });
    console.log(`   - Total expected interest: $${processedLoans.reduce((sum, l) => sum + l.expected_total_interest, 0).toFixed(2)}`);
    console.log(`   - Total interest collected: $${processedLoans.reduce((sum, l) => sum + l.total_interest_paid, 0).toFixed(2)}`);

    res.json({
      success: true,
      data: processedLoans,
      total: processedLoans.length,
      summary: {
        // Loan status summary with special project handling
        active_loans: processedLoans.filter(l => l.loan_status === 'active').length,
        due_soon_loans: processedLoans.filter(l => l.loan_status === 'due_soon').length,
        overdue_loans: processedLoans.filter(l => l.loan_status === 'overdue').length,
        overdue_extension_loans: processedLoans.filter(l => l.loan_status === 'overdue-extension').length,
        completed_loans: processedLoans.filter(l => l.loan_status === 'completed').length,
        pending_loans: processedLoans.filter(l => l.loan_status === 'pending').length,
        
        // Upfront interest payment summary with special project handling
        interest_paid: processedLoans.filter(l => l.interest_status === 'paid').length,
        interest_partial: processedLoans.filter(l => l.interest_status === 'partial').length,
        interest_overdue: processedLoans.filter(l => l.interest_status === 'overdue').length,
        interest_overdue_extension: processedLoans.filter(l => l.interest_status === 'overdue-extension').length,
        interest_pending: processedLoans.filter(l => l.interest_status === 'pending').length,
        
        // Special projects summary
        special_projects: {
          total: processedLoans.filter(l => [59, 55, 51].includes(l.project_id)).length,
          overdue: processedLoans.filter(l => [59, 55, 51].includes(l.project_id) && l.loan_status === 'overdue').length,
          overdue_extension: processedLoans.filter(l => [59, 55, 51].includes(l.project_id) && l.loan_status === 'overdue-extension').length,
          other: processedLoans.filter(l => [59, 55, 51].includes(l.project_id) && !['overdue', 'overdue-extension'].includes(l.loan_status)).length
        },
        
        // Financial summary
        total_loan_value: processedLoans.reduce((sum, l) => sum + parseFloat(l.loan_amount || 0), 0),
        total_expected_interest: processedLoans.reduce((sum, l) => sum + l.expected_total_interest, 0),
        total_interest_collected: processedLoans.reduce((sum, l) => sum + l.total_interest_paid, 0),
        collection_rate: processedLoans.reduce((sum, l) => sum + l.expected_total_interest, 0) > 0 ? 
          Math.round((processedLoans.reduce((sum, l) => sum + l.total_interest_paid, 0) / 
                     processedLoans.reduce((sum, l) => sum + l.expected_total_interest, 0)) * 100) : 0
      }
    });
  } catch (error) {
    console.error('❌ Error fetching loans:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching loans from database',
      error: error.message
    });
  }
});

module.exports = router;