-- =====================================
-- Simple Loans View - Quick Overview
-- =====================================

-- Basic loan information with key metrics
SELECT 
    s.id as stage_id,
    p.name as project_title,
    s.loan_amount,
    ROUND(s.interest_rate * 100, 2) as interest_rate_percent,
    s.loan_start_date,
    s.loan_repayment_date,
    DATEDIFF(s.loan_repayment_date, CURDATE()) as days_to_maturity,
    
    -- Payment summary
    COALESCE(payment_summary.total_paid, 0) as total_interest_paid,
    COALESCE(payment_summary.payment_count, 0) as payment_count,
    payment_summary.last_payment_date,
    
    -- Status flags
    CASE WHEN p.id IN (59, 55, 51) THEN 'SPECIAL' ELSE 'NORMAL' END as project_type,
    
    -- Simple status
    CASE 
        WHEN CURDATE() < s.loan_start_date THEN 'PENDING'
        WHEN s.loan_repayment_date < CURDATE() THEN 'OVERDUE'
        WHEN DATEDIFF(s.loan_repayment_date, CURDATE()) <= 7 THEN 'DUE_SOON'
        WHEN DATEDIFF(s.loan_repayment_date, CURDATE()) <= 30 THEN 'DUE_THIS_MONTH'
        ELSE 'ACTIVE'
    END as status

FROM stage s
LEFT JOIN project p ON s.project_id = p.id
LEFT JOIN (
    SELECT 
        stage_id, 
        SUM(money) as total_paid, 
        COUNT(*) as payment_count,
        MAX(date) as last_payment_date
    FROM invest_interest 
    GROUP BY stage_id
) payment_summary ON s.id = payment_summary.stage_id

WHERE s.status IN ('operating', 'performing')
  AND (p.id IN (59, 55, 51) OR s.loan_repayment_date >= CURDATE())

ORDER BY 
    CASE 
        WHEN s.loan_repayment_date < CURDATE() THEN 1
        WHEN DATEDIFF(s.loan_repayment_date, CURDATE()) <= 7 THEN 2
        WHEN DATEDIFF(s.loan_repayment_date, CURDATE()) <= 30 THEN 3
        ELSE 4
    END,
    s.loan_repayment_date ASC;

-- =====================================
-- Quick Counts by Status
-- =====================================

SELECT 
    CASE 
        WHEN CURDATE() < s.loan_start_date THEN 'PENDING'
        WHEN s.loan_repayment_date < CURDATE() THEN 'OVERDUE'
        WHEN DATEDIFF(s.loan_repayment_date, CURDATE()) <= 7 THEN 'DUE_SOON'
        WHEN DATEDIFF(s.loan_repayment_date, CURDATE()) <= 30 THEN 'DUE_THIS_MONTH'
        ELSE 'ACTIVE'
    END as status,
    COUNT(*) as count,
    SUM(s.loan_amount) as total_value
FROM stage s
LEFT JOIN project p ON s.project_id = p.id
WHERE s.status IN ('operating', 'performing')
  AND (p.id IN (59, 55, 51) OR s.loan_repayment_date >= CURDATE())
GROUP BY status
ORDER BY 
    CASE status
        WHEN 'OVERDUE' THEN 1
        WHEN 'DUE_SOON' THEN 2
        WHEN 'DUE_THIS_MONTH' THEN 3
        WHEN 'ACTIVE' THEN 4
        WHEN 'PENDING' THEN 5
    END; 