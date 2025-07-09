const express = require('express');
const router = express.Router();
const db = require('../database/connection');
const {
  calculateUpfrontInterest,
  calculateBasePaymentDate,
  generatePaymentSchedule,
  getLoanStatus
} = require('../utils/calculations');

// Get general payment reminders (borrower payments)
router.get('/', async (req, res) => {
  try {
    console.log('⏰ Fetching payment reminders (upfront interest model)...');
    
    const fourteenDaysFromNow = new Date();
    fourteenDaysFromNow.setDate(fourteenDaysFromNow.getDate() + 14);
    
    // Get active loans, excluding those with past end dates (except special projects)
    const activeLoans = await db.query(`
      SELECT 
        s.id,
        s.loan_amount,
        s.loan_start_date,
        s.loan_repayment_date,
        s.loan_expiry_date,
        s.interest_rate as borrower_interest_rate,
        p.name as project_title,
        p.id as project_id
      FROM stage s
      LEFT JOIN project p ON s.project_id = p.id
      WHERE s.status IN ('operating', 'performing')
        AND (p.id IN (59, 55, 51) OR s.loan_repayment_date >= CURDATE())
    `);

    const reminders = [];
    const currentDate = new Date();

    for (const loan of activeLoans) {
      const loanStartDate = new Date(loan.loan_start_date);
      const principalDate = new Date(loan.loan_repayment_date);
      
      // Check for upcoming contract start dates (upfront interest due)
      const daysToStart = Math.ceil((loanStartDate - currentDate) / (1000 * 60 * 60 * 24));
      
      if (daysToStart <= 14 && daysToStart >= 0) {
        // Calculate expected upfront interest
        const upfrontInterest = calculateUpfrontInterest(
          parseFloat(loan.loan_amount),
          loan.borrower_interest_rate,
          loan.loan_start_date,
          loan.loan_repayment_date
        );
        
        reminders.push({
          id: loan.id,
          projectTitle: loan.project_title || 'Unknown Project',
          loanAmount: loan.loan_amount,
          expectedInterest: Math.round(upfrontInterest.totalInterest * 100) / 100,
          dueDate: loanStartDate.toISOString().slice(0, 10),
          daysUntilDue: daysToStart,
          urgencyLevel: daysToStart <= 7 ? 'urgent' : 'upcoming',
          reminderType: 'upfront_interest',
          status: 'upcoming'
        });
      }
      
      // Check for upcoming principal payments
      const daysToPrincipal = Math.ceil((principalDate - currentDate) / (1000 * 60 * 60 * 24));
      
      if (daysToPrincipal <= 14 && daysToPrincipal >= -365) {
        // Calculate proper loan status using the same logic as main endpoint
        const loanStatus = getLoanStatus(
          loan.project_id,
          loan.loan_start_date,
          loan.loan_repayment_date,
          daysToPrincipal,
          loan.loan_expiry_date
        );
        
        // Determine urgency and status based on loan status
        let urgencyLevel = 'upcoming';
        let status = 'upcoming';
        
        if (loanStatus === 'overdue' || loanStatus === 'overdue-extension') {
          urgencyLevel = 'urgent';
          status = loanStatus;
        } else if (daysToPrincipal <= 7) {
          urgencyLevel = 'urgent';
        } else if (daysToPrincipal <= 0) {
          status = 'overdue';
          urgencyLevel = 'urgent';
        }
        
        reminders.push({
          id: loan.id,
          projectTitle: loan.project_title || 'Unknown Project',
          loanAmount: loan.loan_amount,
          dueDate: loan.loan_repayment_date,
          daysUntilDue: daysToPrincipal,
          urgencyLevel: urgencyLevel,
          reminderType: 'principal_payment',
          status: status,
          loanStatus: loanStatus, // Include calculated loan status for reference
          isSpecialProject: [59, 55, 51].includes(loan.project_id)
        });
      }
    }

    // Sort by due date
    reminders.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    console.log(`✅ Found ${reminders.length} payment reminders`);

    res.json({
      success: true,
      data: reminders,
      summary: {
        urgent: reminders.filter(r => r.urgencyLevel === 'urgent').length,
        upcoming: reminders.filter(r => r.urgencyLevel === 'upcoming').length,
        overdue: reminders.filter(r => r.status === 'overdue').length,
        overdue_extension: reminders.filter(r => r.status === 'overdue-extension').length,
        upfront_interest: reminders.filter(r => r.reminderType === 'upfront_interest').length,
        principal_payments: reminders.filter(r => r.reminderType === 'principal_payment').length,
        special_projects: reminders.filter(r => r.isSpecialProject === true).length
      }
    });
  } catch (error) {
    console.error('❌ Error fetching reminders:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching reminders',
      error: error.message
    });
  }
});

// Get investor payment reminders - grouped by project
router.get('/investors', async (req, res) => {
  try {
    console.log('💰 Fetching investor payment reminders...');
    
    const daysAhead = parseInt(req.query.days) || 30; // Default 30 days ahead
    
    // Get active loans with investor funding
    const activeLoans = await db.query(`
      SELECT 
        s.id as stage_id,
        s.loan_amount,
        s.loan_start_date,
        s.loan_repayment_date,
        p.name as project_title,
        p.id as project_id
      FROM stage s
      LEFT JOIN project p ON s.project_id = p.id
      WHERE s.status IN ('operating', 'performing')
        AND (p.id IN (59, 55, 51) OR s.loan_repayment_date >= CURDATE())
    `);

    // Get investor funding with payment details
    const investorFunding = await db.query(`
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
        a.email as investor_email,
        a.phone as investor_phone,
        (SELECT MAX(ii.date) 
         FROM invest_interest ii 
         WHERE ii.stage_id = inf.stage_id 
           AND ii.investor_id = inf.investor_id) as last_payment_date,
        (SELECT COUNT(ii.id) 
         FROM invest_interest ii 
         WHERE ii.stage_id = inf.stage_id 
           AND ii.investor_id = inf.investor_id) as payment_count
      FROM invest_funding inf
      JOIN stage s ON inf.stage_id = s.id
      LEFT JOIN project p ON s.project_id = p.id  
      LEFT JOIN account a ON inf.investor_id = a.id
      WHERE inf.type = 'Investment'
        AND s.status IN ('operating', 'performing')
        AND (s.project_id IN (59, 55, 51) OR s.loan_repayment_date >= CURDATE())
        AND inf.income_rate IS NOT NULL
        AND inf.income_rate > 0
    `);

    // Get existing payment reminders status (if we have a tracking table)
    // Keep data for 3 years but hide from frontend after 15 days when paid/ignored
    const paymentReminders = await db.query(`
      SELECT 
        stage_id,
        investor_id,
        scheduled_date,
        is_paid,
        is_ignored,
        marked_paid_at,
        marked_ignored_at,
        marked_by_user
      FROM investor_payment_reminders 
      WHERE scheduled_date >= DATE_SUB(CURDATE(), INTERVAL 3 YEAR)
        AND scheduled_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
        AND (
          -- Always show active (unpaid/unignored) reminders
          (is_paid = FALSE AND is_ignored = FALSE) OR
          -- Only show paid/ignored items for 15 days, then hide from frontend
          (is_paid = TRUE AND DATEDIFF(CURDATE(), marked_paid_at) <= 15) OR
          (is_ignored = TRUE AND DATEDIFF(CURDATE(), marked_ignored_at) <= 15)
        )
    `, [daysAhead]).catch(() => []); // Handle if table doesn't exist yet

    // Calculate prediction end date
    const predictionEndDate = new Date();
    predictionEndDate.setDate(predictionEndDate.getDate() + daysAhead);

    // Process investor payment schedules
    const projectReminders = {};

    for (const investor of investorFunding) {
      const basePaymentDate = calculateBasePaymentDate(
        investor.last_payment_date,
        investor.investor_start_date,
        investor.transcation_date
      );
      
      const paymentSchedule = generatePaymentSchedule(
        basePaymentDate,
        investor.investor_end_date,
        predictionEndDate,
        !!investor.last_payment_date
      );
      
      // Filter payments due in the next X days
      const upcomingPayments = paymentSchedule.filter(paymentDate => {
        const daysUntilPayment = Math.ceil((paymentDate - new Date()) / (1000 * 60 * 60 * 24));
        return daysUntilPayment >= 0 && daysUntilPayment <= daysAhead;
      });
      
      // Process each upcoming payment
      upcomingPayments.forEach(paymentDate => {
        const monthlyRate = parseFloat(investor.investor_rate) / 12;
        let paymentAmount = parseFloat(investor.investment_amount) * monthlyRate;
        const daysUntilPayment = Math.ceil((paymentDate - new Date()) / (1000 * 60 * 60 * 24));
        
        // Check if this is the final payment and needs prorating
        const investmentEndDate = new Date(investor.investor_end_date);
        const isLastPayment = paymentDate.getTime() === investmentEndDate.getTime() || 
                             (paymentDate > investmentEndDate && Math.abs(paymentDate - investmentEndDate) < 7 * 24 * 60 * 60 * 1000); // Within 7 days
        
        if (isLastPayment) {
          // Calculate prorated amount for remaining days
          const lastPaymentDate = investor.last_payment_date ? new Date(investor.last_payment_date) : new Date(investor.investor_start_date);
          const remainingDays = Math.ceil((investmentEndDate - lastPaymentDate) / (1000 * 60 * 60 * 24));
          
          // If remaining days are less than a full month, prorate the payment
          if (remainingDays < 30) {
            const daysInMonth = new Date(investmentEndDate.getFullYear(), investmentEndDate.getMonth() + 1, 0).getDate();
            const dailyRate = monthlyRate / daysInMonth;
            paymentAmount = parseFloat(investor.investment_amount) * dailyRate * remainingDays;
            
            console.log(`💰 Prorated final payment for investor ${investor.investor_id} in stage ${investor.stage_id}:`);
            console.log(`   Investment end date: ${investmentEndDate.toISOString().slice(0, 10)}`);
            console.log(`   Last payment date: ${lastPaymentDate.toISOString().slice(0, 10)}`);
            console.log(`   Remaining days: ${remainingDays}`);
            console.log(`   Days in final month: ${daysInMonth}`);
            console.log(`   Monthly rate: ${monthlyRate.toFixed(6)}`);
            console.log(`   Daily rate: ${dailyRate.toFixed(8)}`);
            console.log(`   Standard monthly payment: $${(parseFloat(investor.investment_amount) * monthlyRate).toFixed(2)}`);
            console.log(`   Prorated payment: $${paymentAmount.toFixed(2)}`);
          }
        }
        
        // Find project info
        const project = activeLoans.find(loan => loan.stage_id === investor.stage_id);
        if (!project) return;
        
        // Check if this payment is already marked as paid or ignored
        const reminderStatus = paymentReminders.find(r => 
          r.stage_id === investor.stage_id && 
          r.investor_id === investor.investor_id &&
          Math.abs((new Date(r.scheduled_date) - paymentDate) / (1000 * 60 * 60 * 24)) < 1 // Same day
        );
        
        // Group by project
        if (!projectReminders[project.project_id]) {
          projectReminders[project.project_id] = {
            projectId: project.project_id,
            projectTitle: project.project_title,
            stageId: project.stage_id,
            loanAmount: project.loan_amount,
            totalInvestorsCount: 0,
            totalPaymentAmount: 0,
            upcomingPayments: [],
            urgencyLevel: 'upcoming'
          };
        }
        
        // Add investor payment details
        projectReminders[project.project_id].upcomingPayments.push({
          fundingId: investor.funding_id,
          investorId: investor.investor_id,
          investorName: investor.investor_name || `Investor ${investor.investor_id}`,
          investorEmail: investor.investor_email,
          investorPhone: investor.investor_phone,
          investmentAmount: parseFloat(investor.investment_amount),
          annualRate: parseFloat(investor.investor_rate) * 100,
          monthlyPayment: paymentAmount, // Use calculated amount (prorated if final payment)
          scheduledDate: paymentDate.toISOString().slice(0, 10),
          daysUntilPayment: daysUntilPayment,
          lastPaymentDate: investor.last_payment_date,
          paymentCount: investor.payment_count,
          urgencyLevel: daysUntilPayment <= 7 ? 'urgent' : 'upcoming',
          isPaid: reminderStatus ? reminderStatus.is_paid : false,
          isIgnored: reminderStatus ? reminderStatus.is_ignored : false,
          markedPaidAt: reminderStatus ? reminderStatus.marked_paid_at : null,
          markedIgnoredAt: reminderStatus ? reminderStatus.marked_ignored_at : null,
          markedByUser: reminderStatus ? reminderStatus.marked_by_user : null,
          reminderKey: `${investor.stage_id}|${investor.investor_id}|${paymentDate.toISOString().slice(0, 10)}`,
          isProrated: isLastPayment && paymentAmount < (parseFloat(investor.investment_amount) * monthlyRate), // Flag for frontend
          proratedDays: isLastPayment ? Math.ceil((investmentEndDate - (investor.last_payment_date ? new Date(investor.last_payment_date) : new Date(investor.investor_start_date))) / (1000 * 60 * 60 * 24)) : null
        });
        
        // Update project totals
        projectReminders[project.project_id].totalPaymentAmount += paymentAmount;
        
        // Set project urgency level (most urgent wins)
        if (daysUntilPayment <= 7) {
          projectReminders[project.project_id].urgencyLevel = 'urgent';
        }
      });
    }

    // Calculate unique investors per project and sort payments
    Object.values(projectReminders).forEach(project => {
      project.totalInvestorsCount = [...new Set(project.upcomingPayments.map(p => p.investorId))].length;
      project.upcomingPayments.sort((a, b) => a.daysUntilPayment - b.daysUntilPayment);
      project.totalPaymentAmount = Math.round(project.totalPaymentAmount * 100) / 100;
    });

    // Convert to array and sort by urgency and date
    const remindersList = Object.values(projectReminders).sort((a, b) => {
      if (a.urgencyLevel === 'urgent' && b.urgencyLevel !== 'urgent') return -1;
      if (b.urgencyLevel === 'urgent' && a.urgencyLevel !== 'urgent') return 1;
      
      const aEarliestPayment = Math.min(...a.upcomingPayments.map(p => p.daysUntilPayment));
      const bEarliestPayment = Math.min(...b.upcomingPayments.map(p => p.daysUntilPayment));
      return aEarliestPayment - bEarliestPayment;
    });

    // Calculate summary statistics
    const allPayments = remindersList.flatMap(p => p.upcomingPayments);
    const summary = {
      totalProjects: remindersList.length,
      totalInvestors: [...new Set(allPayments.map(pay => pay.investorId))].length,
      totalPaymentAmount: remindersList.reduce((sum, p) => sum + p.totalPaymentAmount, 0),
      urgentProjects: remindersList.filter(p => p.urgencyLevel === 'urgent').length,
      urgentPayments: allPayments.filter(p => p.urgencyLevel === 'urgent').length,
      unpaidPayments: allPayments.filter(p => !p.isPaid && !p.isIgnored).length,
      paidPayments: allPayments.filter(p => p.isPaid).length,
      ignoredPayments: allPayments.filter(p => p.isIgnored).length,
      overduePayments: allPayments.filter(p => p.daysUntilPayment < 0 && !p.isPaid && !p.isIgnored).length
    };

    console.log(`✅ Found ${remindersList.length} projects with upcoming investor payments`);
    console.log(`💰 Total payment amount due: $${summary.totalPaymentAmount.toFixed(2)}`);
    console.log(`🚨 Urgent payments: ${summary.urgentPayments}`);

    res.json({
      success: true,
      data: remindersList,
      summary: summary
    });
    
  } catch (error) {
    console.error('❌ Error fetching investor payment reminders:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching investor payment reminders',
      error: error.message
    });
  }
});

// Mark investor payment as paid/unpaid or ignored
router.post('/investors/mark-status', async (req, res) => {
  try {
    const { reminderKey, isPaid, isIgnored, userNote } = req.body;
    
    // Parse reminder key: stageId|investorId|date
    const [stageId, investorId, scheduledDate] = reminderKey.split('|');
    
    const status = isPaid ? 'PAID' : isIgnored ? 'IGNORED' : 'ACTIVE';
    console.log(`💰 Marking investor payment as ${status}:`);
    console.log(`   ReminderKey: ${reminderKey}`);
    console.log(`   Parsed - Stage: ${stageId}, Investor: ${investorId}, Date: ${scheduledDate}`);
    
    // Create investor_payment_reminders table if it doesn't exist
    // Data retention: 3 years for records, 15 days frontend visibility for paid/ignored
    await db.query(`
      CREATE TABLE IF NOT EXISTS investor_payment_reminders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        stage_id INT NOT NULL,
        investor_id INT NOT NULL,
        scheduled_date DATE NOT NULL,
        is_paid BOOLEAN DEFAULT FALSE,
        is_ignored BOOLEAN DEFAULT FALSE,
        marked_paid_at DATETIME DEFAULT NULL,
        marked_ignored_at DATETIME DEFAULT NULL,
        marked_by_user VARCHAR(255) DEFAULT 'manual',
        user_note TEXT DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_payment (stage_id, investor_id, scheduled_date),
        INDEX idx_scheduled_date (scheduled_date),
        INDEX idx_marked_paid_at (marked_paid_at),
        INDEX idx_marked_ignored_at (marked_ignored_at)
      )
    `);
    
    // Add missing columns if they don't exist (for existing tables)
    try {
      await db.query(`ALTER TABLE investor_payment_reminders ADD COLUMN is_ignored BOOLEAN DEFAULT FALSE`);
      console.log('✅ Added is_ignored column to investor_payment_reminders table');
    } catch (error) {
      if (!error.message.includes('Duplicate column name')) {
        console.log('ℹ️ is_ignored column already exists or other error:', error.message);
      }
    }
    
    try {
      await db.query(`ALTER TABLE investor_payment_reminders ADD COLUMN marked_ignored_at DATETIME DEFAULT NULL`);
      console.log('✅ Added marked_ignored_at column to investor_payment_reminders table');
    } catch (error) {
      if (!error.message.includes('Duplicate column name')) {
        console.log('ℹ️ marked_ignored_at column already exists or other error:', error.message);
      }
    }
    
    // Insert or update payment reminder status
    await db.query(`
      INSERT INTO investor_payment_reminders 
        (stage_id, investor_id, scheduled_date, is_paid, is_ignored, marked_paid_at, marked_ignored_at, marked_by_user, user_note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        is_paid = VALUES(is_paid),
        is_ignored = VALUES(is_ignored),
        marked_paid_at = VALUES(marked_paid_at),
        marked_ignored_at = VALUES(marked_ignored_at),
        marked_by_user = VALUES(marked_by_user),
        user_note = VALUES(user_note),
        updated_at = CURRENT_TIMESTAMP
    `, [
      parseInt(stageId),
      parseInt(investorId), 
      scheduledDate,
      isPaid || false,
      isIgnored || false,
      isPaid ? new Date() : null,
      isIgnored ? new Date() : null,
      'manual',
      userNote || null
    ]);
    
    res.json({
      success: true,
      message: `Payment marked as ${status.toLowerCase()}`,
      data: {
        stageId: parseInt(stageId),
        investorId: parseInt(investorId),
        scheduledDate: scheduledDate,
        isPaid: isPaid || false,
        isIgnored: isIgnored || false,
        markedAt: isPaid ? new Date() : (isIgnored ? new Date() : null)
      }
    });
    
  } catch (error) {
    console.error('❌ Error marking payment status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating payment status',
      error: error.message
    });
  }
});

module.exports = router;