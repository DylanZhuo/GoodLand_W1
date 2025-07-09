-- =====================================
-- Goodland LMS - View All Loans Script
-- =====================================
-- This script shows all loan information with status calculations
-- matching the behavior of the /api/loans endpoint

SELECT 
    -- Basic Loan Information
    s.id as stage_id,
    p.id as project_id,
    p.name as project_title,
    s.loan_amount,
    s.interest_rate as borrower_interest_rate_decimal,
    ROUND(s.interest_rate * 100, 2) as borrower_interest_rate_percent,
    s.default_rate as default_rate_decimal,
    ROUND(s.default_rate * 100, 2) as default_rate_percent,
    
    -- Dates
    s.loan_start_date,
    s.loan_repayment_date,
    s.loan_expiry_date,
    s.status as stage_status,
    p.status as project_status,
    
    -- Date Calculations
    DATEDIFF(s.loan_repayment_date, CURDATE()) as days_to_maturity,
    DATEDIFF(s.loan_start_date, CURDATE()) as days_to_start,
    DATEDIFF(s.loan_repayment_date, s.loan_start_date) as contract_total_days,
    
    -- Payment Information
    COALESCE(payment_summary.total_interest_paid, 0) as total_interest_paid,
    COALESCE(payment_summary.payment_count, 0) as payment_count,
    payment_summary.last_payment_date,
    payment_summary.first_payment_date,
    
    -- Expected Interest Calculation (Upfront Model)
    -- Full months calculation
    FLOOR(DATEDIFF(s.loan_repayment_date, s.loan_start_date) / 30) as estimated_full_months,
    
    -- Estimated expected interest (simplified calculation)
    ROUND(
        s.loan_amount * s.interest_rate * 
        (DATEDIFF(s.loan_repayment_date, s.loan_start_date) / 365), 
        2
    ) as estimated_expected_interest,
    
    -- Payment Completion Percentage
    CASE 
        WHEN COALESCE(payment_summary.total_interest_paid, 0) = 0 THEN 0
        ELSE ROUND(
            (COALESCE(payment_summary.total_interest_paid, 0) / 
             NULLIF(s.loan_amount * s.interest_rate * (DATEDIFF(s.loan_repayment_date, s.loan_start_date) / 365), 0)
            ) * 100, 2
        )
    END as payment_completion_percent,
    
    -- Interest Status Logic (Simplified)
    CASE 
        -- Contract hasn't started yet
        WHEN CURDATE() < s.loan_start_date THEN 'pending'
        
        -- Special projects (59, 55, 51) - check for overdue conditions
        WHEN p.id IN (59, 55, 51) AND s.loan_repayment_date < CURDATE() THEN 'overdue'
        WHEN p.id IN (59, 55, 51) AND s.loan_expiry_date < s.loan_repayment_date THEN 'overdue-extension'
        
        -- No payment made after contract start
        WHEN CURDATE() >= s.loan_start_date AND COALESCE(payment_summary.total_interest_paid, 0) = 0 THEN 'overdue'
        
        -- Check if payment is sufficient (within 1% tolerance)
        WHEN COALESCE(payment_summary.total_interest_paid, 0) >= 
             (s.loan_amount * s.interest_rate * (DATEDIFF(s.loan_repayment_date, s.loan_start_date) / 365) * 0.99) 
        THEN 'paid'
        
        -- Partial payment made
        WHEN COALESCE(payment_summary.total_interest_paid, 0) > 0 THEN 'partial'
        
        ELSE 'unknown'
    END as interest_status,
    
    -- Loan Status Logic
    CASE 
        -- Special projects first
        WHEN p.id IN (59, 55, 51) AND s.loan_repayment_date < CURDATE() THEN 'overdue'
        WHEN p.id IN (59, 55, 51) AND s.loan_expiry_date < s.loan_repayment_date THEN 'overdue-extension'
        
        -- Contract hasn't started
        WHEN s.loan_start_date > CURDATE() AND DATEDIFF(s.loan_repayment_date, CURDATE()) <= 14 THEN 'starting_soon'
        WHEN s.loan_start_date > CURDATE() THEN 'pending'
        
        -- Contract has ended
        WHEN s.loan_repayment_date < CURDATE() THEN 'completed'
        
        -- Based on days to maturity
        WHEN DATEDIFF(s.loan_repayment_date, CURDATE()) <= 0 THEN 'overdue'
        WHEN DATEDIFF(s.loan_repayment_date, CURDATE()) <= 7 THEN 'due_soon'
        WHEN DATEDIFF(s.loan_repayment_date, CURDATE()) <= 14 THEN 'due_this_week'
        WHEN DATEDIFF(s.loan_repayment_date, CURDATE()) <= 30 THEN 'due_this_month'
        
        ELSE 'active'
    END as loan_status,
    
    -- Special Project Flag
    CASE WHEN p.id IN (59, 55, 51) THEN 'YES' ELSE 'NO' END as is_special_project,
    
    -- Additional Insights
    CASE 
        WHEN s.loan_start_date > CURDATE() THEN 'Future Contract'
        WHEN s.loan_repayment_date < CURDATE() THEN 'Past Due Date'
        WHEN DATEDIFF(s.loan_repayment_date, CURDATE()) <= 30 THEN 'Due Soon'
        ELSE 'Active'
    END as contract_phase

FROM stage s
LEFT JOIN project p ON s.project_id = p.id

-- Subquery to get payment summary for each stage
LEFT JOIN (
    SELECT 
        stage_id,
        SUM(money) as total_interest_paid,
        COUNT(*) as payment_count,
        MAX(date) as last_payment_date,
        MIN(date) as first_payment_date
    FROM invest_interest 
    GROUP BY stage_id
) payment_summary ON s.id = payment_summary.stage_id

-- Filter conditions (matching your API logic)
WHERE s.status IN ('operating', 'performing')
  AND (p.id IN (59, 55, 51) OR s.loan_repayment_date >= CURDATE())

-- Ordering
ORDER BY 
    -- Show urgent/overdue loans first
    CASE 
        WHEN p.id IN (59, 55, 51) AND s.loan_repayment_date < CURDATE() THEN 1
        WHEN p.id IN (59, 55, 51) AND s.loan_expiry_date < s.loan_repayment_date THEN 2
        WHEN DATEDIFF(s.loan_repayment_date, CURDATE()) <= 0 THEN 3
        WHEN DATEDIFF(s.loan_repayment_date, CURDATE()) <= 7 THEN 4
        WHEN DATEDIFF(s.loan_repayment_date, CURDATE()) <= 30 THEN 5
        ELSE 6
    END,
    s.loan_repayment_date ASC

LIMIT 100;

-- =====================================
-- Additional Queries for Analysis
-- =====================================

-- Summary Statistics
SELECT 
    'LOAN SUMMARY' as metric_type,
    COUNT(*) as total_loans,
    SUM(s.loan_amount) as total_loan_value,
    AVG(s.loan_amount) as avg_loan_amount,
    SUM(COALESCE(payment_summary.total_interest_paid, 0)) as total_interest_collected,
    COUNT(CASE WHEN p.id IN (59, 55, 51) THEN 1 END) as special_projects_count
FROM stage s
LEFT JOIN project p ON s.project_id = p.id
LEFT JOIN (
    SELECT stage_id, SUM(money) as total_interest_paid
    FROM invest_interest 
    GROUP BY stage_id
) payment_summary ON s.id = payment_summary.stage_id
WHERE s.status IN ('operating', 'performing')
  AND (p.id IN (59, 55, 51) OR s.loan_repayment_date >= CURDATE());

-- Status Breakdown
SELECT 
    CASE 
        WHEN p.id IN (59, 55, 51) AND s.loan_repayment_date < CURDATE() THEN 'overdue'
        WHEN p.id IN (59, 55, 51) AND s.loan_expiry_date < s.loan_repayment_date THEN 'overdue-extension'
        WHEN s.loan_start_date > CURDATE() THEN 'pending'
        WHEN s.loan_repayment_date < CURDATE() THEN 'completed'
        WHEN DATEDIFF(s.loan_repayment_date, CURDATE()) <= 7 THEN 'due_soon'
        WHEN DATEDIFF(s.loan_repayment_date, CURDATE()) <= 30 THEN 'due_this_month'
        ELSE 'active'
    END as loan_status,
    COUNT(*) as count,
    SUM(s.loan_amount) as total_value,
    GROUP_CONCAT(DISTINCT p.name SEPARATOR ', ') as projects
FROM stage s
LEFT JOIN project p ON s.project_id = p.id
WHERE s.status IN ('operating', 'performing')
  AND (p.id IN (59, 55, 51) OR s.loan_repayment_date >= CURDATE())
GROUP BY loan_status
ORDER BY 
    CASE loan_status
        WHEN 'overdue' THEN 1
        WHEN 'overdue-extension' THEN 2
        WHEN 'due_soon' THEN 3
        WHEN 'due_this_month' THEN 4
        WHEN 'active' THEN 5
        WHEN 'pending' THEN 6
        WHEN 'completed' THEN 7
        ELSE 8
    END;

-- Special Projects Detail (59, 55, 51)
SELECT 
    'SPECIAL PROJECTS' as section,
    p.id as project_id,
    p.name as project_name,
    s.id as stage_id,
    s.loan_amount,
    s.loan_start_date,
    s.loan_repayment_date,
    s.loan_expiry_date,
    DATEDIFF(s.loan_repayment_date, CURDATE()) as days_to_repayment,
    DATEDIFF(s.loan_expiry_date, CURDATE()) as days_to_expiry,
    CASE 
        WHEN s.loan_repayment_date < CURDATE() THEN 'OVERDUE'
        WHEN s.loan_expiry_date < s.loan_repayment_date THEN 'EXPIRY_BEFORE_REPAYMENT'
        ELSE 'NORMAL'
    END as special_status
FROM stage s
LEFT JOIN project p ON s.project_id = p.id
WHERE p.id IN (59, 55, 51)
  AND s.status IN ('operating', 'performing')
ORDER BY s.loan_repayment_date;

-- Recent Payment Activity
SELECT 
    'RECENT PAYMENTS' as section,
    ii.stage_id,
    p.name as project_name,
    ii.investor_id,
    ii.money as payment_amount,
    ii.date as payment_date,
    DATEDIFF(CURDATE(), ii.date) as days_ago
FROM invest_interest ii
LEFT JOIN stage s ON ii.stage_id = s.id
LEFT JOIN project p ON s.project_id = p.id
WHERE ii.date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
  AND s.status IN ('operating', 'performing')
ORDER BY ii.date DESC
LIMIT 20; 