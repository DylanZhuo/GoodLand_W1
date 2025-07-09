const express = require('express');
const router = express.Router();
const db = require('../database/connection');
const moment = require('moment');

// Calculate interest schedule for a loan
router.get('/schedule/:loanId', async (req, res) => {
  try {
    const { loanId } = req.params;
    const months = parseInt(req.query.months) || 12;
    
    // Get loan details
    const loanQuery = `
      SELECT * FROM stage WHERE id = ? AND status = 'operating'
    `;
    const [loan] = await db.query(loanQuery, [loanId]);
    
    if (!loan) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found or not active'
      });
    }

    // Calculate future interest schedule
    const schedule = [];
    const dailyRate = loan.annual_interest_rate / 365;
    
    for (let i = 0; i < months; i++) {
      const monthDate = moment().add(i, 'months');
      const daysInMonth = monthDate.daysInMonth();
      const monthlyInterest = loan.loan_amount * (dailyRate / 100) * daysInMonth;

      schedule.push({
        month: monthDate.format('YYYY-MM'),
        monthName: monthDate.format('MMMM YYYY'),
        daysInMonth,
        dailyInterest: loan.loan_amount * (dailyRate / 100),
        monthlyInterest: Math.round(monthlyInterest * 100) / 100,
        outstandingPrincipal: loan.loan_amount,
        paymentDue: monthDate.endOf('month').format('YYYY-MM-DD')
      });
    }

    res.json({
      success: true,
      data: {
        loanDetails: loan,
        schedule
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error calculating interest schedule',
      error: error.message
    });
  }
});

module.exports = router;