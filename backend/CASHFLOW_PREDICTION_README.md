# Cashflow Prediction System

## Overview

The cashflow prediction system calculates monthly net cashflow by processing loan income and investor payouts over a 12-month period. The system uses actual payment data and schedule-based calculations to provide realistic cashflow forecasts.

## Core Formula

```
Monthly Net Cashflow = Total Cash Inflows - Total Cash Outflows
```

## Income Components

### Monthly Interest Income

```javascript
FOR each loan:
  IF loan is active AND actualPaidNet > 0:
    IF hasPaymentThisMonth (from payment schedule):
      
      // Standard Monthly Payment
      monthlyInterestAmount = loanAmount × (borrowerAnnualRate / 12)
      
      // Final Month Prorating
      IF isLastMonth:
        daysInMonth = getDaysInMonth(targetMonth)
        actualDaysInMonth = MIN(
          CEIL((loanEndDate - monthStart) / (1000 × 60 × 60 × 24)),
          daysInMonth
        )
        
        dailyRate = (borrowerAnnualRate / 12) / daysInMonth
        monthlyInterestAmount = loanAmount × dailyRate × actualDaysInMonth
      
      // Calculate Tax/Fee Proportions
      grossToNetRatio = actualPaidNet / actualPaidGross
      taxRatio = totalTaxPaid / actualPaidGross
      feeRatio = totalFeesPaid / actualPaidGross
      
      grossAmount = monthlyInterestAmount
      netAmount = grossAmount × grossToNetRatio
      taxAmount = grossAmount × taxRatio
      feeAmount = grossAmount × feeRatio
```

### Principal Repayments

```javascript
Monthly Principal Repayments = Σ(Loan Amount) for loans where:
  loan.loanEndDate >= monthStart AND loan.loanEndDate <= monthEnd
```

## Outflow Components

### Investor Payouts (with Goodland Exclusion)

```javascript
FOR each investor:
  IF investor funding is active during month:
    monthlyPayment = investmentAmount × (annualRate / 12)
    
    IF investor.name does NOT contain "goodland" (case-insensitive):
      totalInvestorPayouts += monthlyPayment
    
    // Always track for transparency
    Add to investorPayouts array with excludedFromOutflows flag
```

## Monthly Processing Logic

```javascript
FOR each month (0 to 11):
  monthStart = first day of target month
  monthEnd = last day of target month
  
  monthData = {
    totalInterestReceivable: 0,
    totalTaxes: 0,
    totalFees: 0,
    totalPrincipalDue: 0,
    totalInvestorPayouts: 0
  }
  
  // Process Borrower Interest Income
  FOR each loan:
    IF loan is active AND has actual payments:
      IF payment scheduled this month:
        Calculate interest amount (with prorating if final month)
        Add to monthData.totalInterestReceivable
  
  // Process Principal Repayments
  FOR each loan:
    IF loan matures this month:
      Add loan amount to monthData.totalPrincipalDue
  
  // Process Investor Payouts
  FOR each investor:
    IF investor funding active this month:
      Calculate monthly payment
      IF NOT Goodland investor:
        Add to monthData.totalInvestorPayouts
  
  // Calculate Monthly Totals
  totalCashInflow = totalInterestReceivable + totalPrincipalDue
  netCashflow = totalCashInflow - totalInvestorPayouts
```

## Edge Cases Handled

### 1. Final Month Prorating
- **Issue**: Loans ending mid-month should not receive full monthly interest
- **Solution**: Calculate daily rate and multiply by actual days in final month
- **Formula**: `dailyRate = (annualRate / 12) / daysInMonth`

### 2. Goodland Investor Exclusion
- **Issue**: Internal company transactions appearing as cash outflows
- **Solution**: Exclude investors with "goodland" in name (case-insensitive)
- **Impact**: Prevents double-counting internal fund movements

### 3. Loans with No Actual Payments
- **Issue**: Theoretical income from non-paying borrowers
- **Solution**: Only include loans where `actualPaidNet > 0`
- **Benefit**: Provides realistic cashflow based on actual performance

### 4. Payment Schedule Synchronization
- **Issue**: Inconsistent payment timing between borrowers and investors
- **Solution**: Use same payment schedule logic (month + 1, days - 1) for both
- **Result**: Aligned payment expectations and cashflow timing

### 5. Partial Month Calculations
- **Issue**: Different month lengths affecting daily rate calculations
- **Solution**: Use actual days in each specific month for prorating
- **Implementation**: `getDaysInMonth()` function for accurate calculations

### 6. Special Project Handling
- **Issue**: Projects 59, 55, 51 have different lifecycle rules
- **Solution**: Included in active loan filter with special conditions
- **Filter**: `(p.id IN (59, 55, 51) OR s.loan_repayment_date >= CURDATE())`

### 7. Zero Division Protection
- **Issue**: Loans with zero gross payments causing calculation errors
- **Solution**: Use fallback value of 1 in ratio calculations
- **Implementation**: `grossToNetRatio = actualPaidNet / (actualPaidGross || 1)`

### 8. Rounding Consistency
- **Issue**: Floating point precision affecting monetary calculations
- **Solution**: Round all monetary values to 2 decimal places
- **Method**: `Math.round(value * 100) / 100`

## Key Business Rules

1. **Reality-Based**: Only loans with actual payments generate income
2. **Schedule-Based**: Income follows payment schedule dates
3. **Prorated Finals**: Final month payments calculated using daily rates
4. **Internal Exclusion**: Goodland transactions excluded from outflows
5. **Proportional Allocation**: Taxes/fees based on actual payment ratios

## Data Dependencies

- Loan payment history (`actualPaidNet`, `actualPaidGross`)
- Tax and fee records (`totalTaxPaid`, `totalFeesPaid`)
- Investor funding details (`investmentAmount`, `annualRate`)
- Payment schedule calculations (`generatePaymentSchedule`)
- Loan lifecycle dates (`loanStartDate`, `loanEndDate`)

## Expected Outputs

- Monthly cashflow predictions for 12 months
- Breakdown of income, outflows, and net cashflow
- Tax and fee tracking for transparency
- Investor payout details with exclusion flags
- Principal maturity schedule 