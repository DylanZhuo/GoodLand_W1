-- =====================================
-- Very Basic Loans Query
-- =====================================
-- Just the essential loan information

SELECT 
    s.id as stage_id,
    p.name as project_name,
    s.loan_amount,
    s.interest_rate,
    s.loan_start_date,
    s.loan_repayment_date,
    s.status as stage_status
FROM stage s
LEFT JOIN project p ON s.project_id = p.id
ORDER BY s.loan_repayment_date;

-- =====================================
-- All Active/Operating Loans Only
-- =====================================

SELECT 
    s.id as stage_id,
    p.name as project_name,
    s.loan_amount,
    ROUND(s.interest_rate * 100, 2) as interest_rate_percent,
    s.loan_start_date,
    s.loan_repayment_date,
    s.status
FROM stage s
LEFT JOIN project p ON s.project_id = p.id
WHERE s.status IN ('operating', 'performing')
ORDER BY s.loan_repayment_date;

-- =====================================
-- Loans with Payment Information
-- =====================================

SELECT 
    s.id as stage_id,
    p.name as project_name,
    s.loan_amount,
    s.loan_start_date,
    s.loan_repayment_date,
    COUNT(ii.id) as payment_count,
    SUM(ii.money) as total_payments,
    MAX(ii.date) as last_payment_date
FROM stage s
LEFT JOIN project p ON s.project_id = p.id
LEFT JOIN invest_interest ii ON s.id = ii.stage_id
WHERE s.status IN ('operating', 'performing')
GROUP BY s.id, p.name, s.loan_amount, s.loan_start_date, s.loan_repayment_date
ORDER BY s.loan_repayment_date; 