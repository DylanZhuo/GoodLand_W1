// Helper function to calculate contract period in months and days (EXACT copy from server_1.js)
function calculateContractPeriod(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Calculate total days
  const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  
  // Calculate full months
  let fullMonths = 0;
  let currentDate = new Date(start);
  
  while (currentDate < end) {
    const nextMonth = new Date(currentDate);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    
    if (nextMonth <= end) {
      fullMonths++;
      currentDate = nextMonth;
    } else {
      break;
    }
  }
  
  // Calculate remaining days in partial month
  const remainingDays = Math.ceil((end - currentDate) / (1000 * 60 * 60 * 24));
  const daysInLastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  
  return {
    fullMonths,
    remainingDays,
    daysInLastMonth,
    totalDays
  };
}

// Helper function to calculate total upfront interest amount (EXACT copy from server_1.js)
function calculateUpfrontInterest(loanAmount, borrowerRate, startDate, endDate) {
  const period = calculateContractPeriod(startDate, endDate);
  
  // Monthly interest rate
  const monthlyRate = borrowerRate / 12;
  
  // Interest for full months
  const fullMonthsInterest = monthlyRate * period.fullMonths * loanAmount;
  
  // Interest for partial month (if any)
  let partialMonthInterest = 0;
  if (period.remainingDays > 0) {
    const dailyRate = monthlyRate / period.daysInLastMonth;
    partialMonthInterest = dailyRate * period.remainingDays * loanAmount;
  }
  
  return {
    fullMonthsInterest,
    partialMonthInterest,
    totalInterest: fullMonthsInterest + partialMonthInterest,
    period
  };
}

// Helper function to determine interest payment status (EXACT copy from server_1.js)
// Interest is due upfront on the start date - no special project logic needed
function getUpfrontInterestStatus(expectedInterest, actualPaidAmount, contractStartDate, projectId, repaymentDate, expiryDate) {
  const currentDate = new Date();
  const startDate = new Date(contractStartDate);
  
  // Debug logging for problematic cases
  const isDebugging = projectId && (
    expectedInterest > 30000 || // Large loans
    actualPaidAmount > 0 // Has some payment
  );
  
  if (isDebugging) {
    console.log(`      🔍 Interest status logic (upfront payment model):`);
    console.log(`        Project ID: ${projectId}`);
    console.log(`        Start date: ${contractStartDate}`);
    console.log(`        Current date: ${currentDate.toISOString().slice(0, 10)}`);
    console.log(`        Contract started: ${currentDate >= startDate}`);
    console.log(`        Expected interest: $${expectedInterest.toFixed(2)}`);
    console.log(`        Actual paid: $${actualPaidAmount.toFixed(2)}`);
  }
  
  // If contract hasn't started yet, interest is pending
  if (currentDate < startDate) {
    if (isDebugging) console.log(`        → RESULT: pending (contract not started)`);
    return 'pending';
  }
  
  // Contract has started - interest should have been paid upfront
  // Simple logic: no payment = overdue, partial payment = partial, full payment = paid
  
  if (!actualPaidAmount || actualPaidAmount === 0) {
    if (isDebugging) console.log(`        → RESULT: overdue (no payment made)`);
    return 'overdue'; // Should have been paid upfront
  }
  
  // Check if payment amount is sufficient (with 1% tolerance for rounding)
  const tolerance = expectedInterest * 0.01;
  const sufficientPayment = actualPaidAmount >= (expectedInterest - tolerance);
  
  if (isDebugging) {
    console.log(`        Tolerance: $${tolerance.toFixed(2)}`);
    console.log(`        Required for 'paid': $${(expectedInterest - tolerance).toFixed(2)}`);
    console.log(`        Sufficient payment: ${sufficientPayment}`);
  }
  
  if (sufficientPayment) {
    if (isDebugging) console.log(`        → RESULT: paid (sufficient payment)`);
    return 'paid'; // Fully paid
  } else {
    if (isDebugging) console.log(`        → RESULT: partial (insufficient payment)`);
    return 'partial'; // Partially paid
  }
}

// Helper function to calculate the base payment date for an investment (EXACT copy from server_1.js)
function calculateBasePaymentDate(lastPaymentDate, startDate, transactionDate) {
  if (lastPaymentDate) {
    return new Date(lastPaymentDate);
  }
  
  // If no previous payment, use the later of start_date or transaction_date
  const baseDate = transactionDate && new Date(transactionDate) > new Date(startDate) 
    ? new Date(transactionDate) 
    : new Date(startDate);
  return baseDate;
}

// Helper function to generate all payment dates for an investment within a date range (EXACT copy from server_1.js)
function generatePaymentSchedule(basePaymentDate, endDate, predictionEndDate, hasLastPayment = false) {
  const payments = [];
  
  if (!basePaymentDate) {
    return payments;
  }
  
  let currentPaymentDate = new Date(basePaymentDate);
  
  // If we have a last payment date, calculate the next payment first
  if (hasLastPayment) {
    // Next payment = last payment + 1 month - 1 day
    currentPaymentDate.setMonth(currentPaymentDate.getMonth() + 1);
    currentPaymentDate.setDate(currentPaymentDate.getDate() - 1);
  }
  
  // Generate all future payments
  while (currentPaymentDate <= new Date(endDate) && currentPaymentDate <= predictionEndDate) {
    // Only include future payments (not past payments)
    if (currentPaymentDate >= new Date()) {
      payments.push(new Date(currentPaymentDate));
    }
    
    // Calculate next payment date
    currentPaymentDate.setMonth(currentPaymentDate.getMonth() + 1);
    currentPaymentDate.setDate(currentPaymentDate.getDate() - 1);
  }
  
  return payments;
}

// Helper function to check if payment is due in a specific month (EXACT copy from server_1.js)
function isPaymentDueInMonth(paymentDate, monthStart, monthEnd) {
  return paymentDate >= monthStart && paymentDate <= monthEnd;
}

// Helper function to determine loan status (EXACT copy from server_1.js)
function getLoanStatus(projectId, loanStartDate, loanEndDate, daysToMaturity, expiryDate) {
  // Special handling for projects 59, 55, 51
  if ([59, 55, 51].includes(projectId)) {
    const currentDate = new Date();
    const endDate = new Date(loanEndDate);
    const expireDate = new Date(expiryDate);
    
    // Scenario 1: If end date (repayment date) is past today
    if (endDate < currentDate) {
      return 'overdue';
    }
    
    // Scenario 2: If expire date is past the repayment date
    if (expireDate < endDate) {
      return 'overdue-extension';
    }
    
    // If neither scenario applies, use normal logic
  }
  
  // If loan hasn't started yet
  if (new Date(loanStartDate) > new Date()) {
    if (daysToMaturity <= 14) {
      return 'starting_soon';
    }
    return 'pending';
  }
  
  // If loan has ended
  if (new Date(loanEndDate) < new Date()) {
    return 'completed';
  }
  
  // Based on days to maturity
  if (daysToMaturity <= 0) {
    return 'overdue';
  } else if (daysToMaturity <= 7) {
    return 'due_soon';
  } else if (daysToMaturity <= 14) {
    return 'due_this_week';
  } else if (daysToMaturity <= 30) {
    return 'due_this_month';
  } else {
    return 'active';
  }
}

module.exports = {
  calculateContractPeriod,
  calculateUpfrontInterest,
  getUpfrontInterestStatus,
  calculateBasePaymentDate,
  generatePaymentSchedule,
  isPaymentDueInMonth,
  getLoanStatus
}; 