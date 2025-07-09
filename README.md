# ⚠️ IMPORTANT NOTES

## 1. 使用说明-数据库说明

- 所有数据均需要在本地 MySQL Workbench 中导入使用。
- 所有数据库相关文件都位于 `database/` 目录中。
- `schema.sql` 是清洗过脏数据之后的数据库结构与数据。
- `goodland_2025-06-30_02-30-02_mysql_data.sql` 是原始数据库数据

## 2. 使用说明-前端说明
- 运行前端之前请运行：npm install安装相关插件。


## 3. Cashflow Prediction 说明

- 所有与现金流预测相关的计算逻辑和说明文档请见：
  - `backend/CASHFLOW_PREDICTION_README.md`

---

# 🛠️ 后续改进建议

### 1. CashFlow Prediction 计算公式

- 具体的公式已在下方展示，公式按照对公司业务理解梳理，如果有逻辑错误，后续修改。
-  `backend/CASHFLOW_PREDICTION_README.md`

### 2. 脏数据 - 重复项与异常值

- 存在及其异常的数据，会严重影响cashflow计算，所以可能显示数字有误。
- 数据库中存在重复的项目信息记录和异常的利息支付数据。
- 某些贷款可能会以不同金额或支付状态重复出现。
- 系统日志会记录重复的项目名称和异常的支付完成百分比。

### 3. 电子邮件和电话信息缺失

- 许多投资者记录缺少电子邮件地址和电话号码。
- 付款提醒系统无法向所有投资者发送通知。
- `/api/reminders/investors` 返回的联系信息不完整。
- 系统仍然生成提醒，但会标记为“联系信息不可用”。

### 4. Investor Reminder收据添加功能
- 后续可在check已支付后添加付款详细信息到现有数据库，目前的数据库只记录时间戳等信息
- 可更改数据库存在时间：从3年到7年


### 5. 状态分类错误

- 有 3 条以上的贷款记录由于状态逻辑冲突被误判为“逾期”。
- “operating”状态的过滤逻辑在某些边缘情况中失效。
- 导致贷款状态报告和现金流预测出现误报。


---




# Goodland LMS - Loan Management System

A comprehensive loan management system for tracking loans, investor payments, and cashflow predictions with React frontend and Node.js backend.

## 🚀 Features

- **Loan Status Tracking**: Upfront interest payment model with automatic status calculations
- **Investor Payment Reminders**: Monthly payment schedules with prorated final payments
- **Cashflow Predictions**: 12-month NET cashflow analysis (borrower payments - investor payouts)
- **Special Project Handling**: Custom logic for specific projects (59, 55, 51)
- **Comprehensive Debugging**: Payment synchronization and duplicate detection tools
- **Modular Architecture**: Clean separation of concerns for maintainability

## 🛠️ Technology Stack

- **Frontend**: React.js, Material-UI, TanStack Query, Chart.js
- **Backend**: Node.js, Express.js, MySQL
- **Database**: MySQL with connection pooling
- **Architecture**: Modular backend with separate route handlers

## 📋 Prerequisites

- Node.js (v16 or higher)
- MySQL (v8.0 or higher)
- npm or yarn package manager

## 🗄️ MySQL Workbench Setup

### 1. Download and Install MySQL Workbench
- Download MySQL Workbench from [official MySQL website](https://dev.mysql.com/downloads/workbench/)
- Install both MySQL Server and MySQL Workbench if you haven't already
- During MySQL Server installation, remember your **root password** - you'll need it later

### 2. Create a New Connection
1. Open MySQL Workbench
2. Click the **"+"** button next to "MySQL Connections"
3. Configure connection details:
   - **Connection Name**: `Goodland LMS`
   - **Hostname**: `127.0.0.1` (or `localhost`)
   - **Port**: `3306` (default)
   - **Username**: `root` (or your MySQL username)
   - **Password**: Click "Store in Vault" and enter your MySQL password
4. Click **"Test Connection"** to verify it works
5. Click **"OK"** to save the connection

### 3. Create the Database
1. Double-click your new connection to open it
2. In the query editor, run:
   ```sql
   CREATE DATABASE goodland_lms;
   USE goodland_lms;
   ```
3. Click the **lightning bolt** icon to execute the query

### 4. Import the Database Data
1. Go to **Server** → **Data Import** in the top menu
2. Select **"Import from Self-Contained File"**
3. Browse and select: `database/goodland_2025-06-30_02-30-02_mysql_data.sql`
4. Under **"Default Target Schema"**, select `goodland_lms`
5. Click **"Start Import"**
6. Wait for the import to complete (this may take a few minutes due to the 6.5MB file size)

### 5. Verify the Import
1. In the **Navigator** panel (left side), click the refresh icon
2. Expand the `goodland_lms` database
3. You should see tables like:
   - `project`
   - `stage`
   - `invest_interest`
   - `invest_funding`
   - `account`
   - And many others
4. You can run this query to verify data is imported:
   ```sql
   SELECT COUNT(*) as total_loans FROM stage WHERE status IN ('operating', 'performing');
   ```

### 6. Configure Backend Database Connection
1. In the `backend/` directory, create a `.env` file:
   ```env
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_mysql_password_here
   DB_NAME=goodland_lms
   DB_PORT=3306
   ```
2. Replace `your_mysql_password_here` with your actual MySQL password

## 🔧 Installation & Setup

> **⚠️ Important Notice**: This system currently has known data quality issues including duplicate records, missing contact information, and status classification problems. Please review the [Known Issues](#️-known-issues--current-limitations) section before proceeding with installation.

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/goodland-lms.git
cd goodland-lms
```

### 2. Backend Setup
```bash
cd backend

# Install dependencies
npm install

# Make sure your .env file is configured (see MySQL setup above)

# Start the backend server
npm start
```

### 3. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Start the development server
npm start
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

## 📡 API Endpoints

### Core Endpoints
- `GET /api/health` - System health check
- `GET /api/loans` - Loan data with status calculations
- `GET /api/reminders` - Payment reminders
- `GET /api/reminders/investors` - Investor payment reminders
- `GET /api/cashflow/monthly` - Monthly cashflow predictions

### Debug Endpoints
- `GET /api/debug/duplicates/:projectName` - Check for duplicate records
- `GET /api/debug/loans/:projectTitle` - Debug loan calculations
- `GET /api/debug/payment-sync/:projectName` - Investigate payment synchronization
- `GET /api/debug/prorated-payments/:stageId/:investorId` - Test prorated calculations

## 🔧 Backend Architecture & Functions

### Server Architecture (`backend/server.js`)

The main server file sets up Express.js with modular routing:

```javascript
const express = require('express');
const cors = require('cors');

// Import route modules
const loansRoutes = require('./src/routes/loans');
const remindersRoutes = require('./src/routes/reminders');
const cashflowRoutes = require('./src/routes/cashflow');
const debugRoutes = require('./src/routes/debug');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware setup
app.use(express.json({ limit: '10mb' }));
app.use(cors(corsOptions));

// Route registration
app.use('/api/loans', loansRoutes);
app.use('/api/reminders', remindersRoutes);
app.use('/api/cashflow', cashflowRoutes);
app.use('/api/debug', debugRoutes);
```

### Database Connection (`backend/src/database/connection.js`)

Manages MySQL connection with connection pooling:

```javascript
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'goodland_lms',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Wrapper function for database queries
const query = async (sql, params = []) => {
  try {
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};
```

## 🧮 Core Calculation Functions (`backend/src/utils/calculations.js`)

### `calculateUpfrontInterest(loanAmount, borrowerRate, startDate, endDate)`

Calculates the exact upfront interest amount using proper daily proration:

```javascript
function calculateUpfrontInterest(loanAmount, borrowerRate, startDate, endDate) {
  const period = calculateContractPeriod(startDate, endDate);
  
  // Monthly interest rate (borrowerRate is decimal: 0.1085 for 10.85%)
  const monthlyRate = borrowerRate / 12;
  
  // Interest for full months
  const fullMonthsInterest = monthlyRate * period.fullMonths * loanAmount;
  
  // Interest for partial month (if any) with daily proration
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
```

**How it works:**
1. **Full Months**: Calculates complete months between start and end dates
2. **Partial Month**: Handles remaining days with daily proration
3. **Daily Rate**: Uses actual days in the last month for accuracy
4. **Returns**: Detailed breakdown of interest calculation

### `calculateContractPeriod(startDate, endDate)`

Precisely calculates loan contract periods:

```javascript
function calculateContractPeriod(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Calculate full months by iterating month by month
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
    totalDays: Math.ceil((end - start) / (1000 * 60 * 60 * 24))
  };
}
```

### `getUpfrontInterestStatus(expectedInterest, actualPaidAmount, contractStartDate, projectId)`

Determines payment status based on upfront payment model:

```javascript
function getUpfrontInterestStatus(expectedInterest, actualPaidAmount, contractStartDate, projectId, repaymentDate, expiryDate) {
  const currentDate = new Date();
  const startDate = new Date(contractStartDate);
  
  // If contract hasn't started yet, interest is pending
  if (currentDate < startDate) {
    return 'pending';
  }
  
  // Contract has started - interest should have been paid upfront
  if (!actualPaidAmount || actualPaidAmount === 0) {
    return 'overdue'; // Should have been paid upfront
  }
  
  // Check if payment amount is sufficient (with 1% tolerance for rounding)
  const tolerance = expectedInterest * 0.01;
  const sufficientPayment = actualPaidAmount >= (expectedInterest - tolerance);
  
  return sufficientPayment ? 'paid' : 'partial';
}
```

## 🛣️ Route Handlers Detailed Explanation

### Loans Route (`backend/src/routes/loans.js`)

#### `GET /api/loans` - Main loan data endpoint

**Purpose**: Retrieves all active loans with calculated statuses and payment information

**Database Query**:
```sql
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
  (SELECT SUM(ii.money) FROM invest_interest ii WHERE ii.stage_id = s.id) as total_interest_paid,
  (SELECT MAX(ii.date) FROM invest_interest ii WHERE ii.stage_id = s.id) as last_payment_date,
  (SELECT COUNT(ii.id) FROM invest_interest ii WHERE ii.stage_id = s.id) as payment_count
FROM stage s
LEFT JOIN project p ON s.project_id = p.id
WHERE s.status IN ('operating', 'performing')
  AND (p.id IN (59, 55, 51) OR s.loan_repayment_date >= CURDATE())
```

**Processing Logic**:
1. **Calculate Expected Interest**: Uses `calculateUpfrontInterest()` with actual contract dates
2. **Determine Interest Status**: Compares actual payments vs expected using `getUpfrontInterestStatus()`
3. **Calculate Loan Status**: Uses `getLoanStatus()` with special project handling
4. **Format Response**: Converts decimals to percentages, adds compatibility fields

**Response Processing**:
```javascript
const processedLoans = loans.map(loan => {
  // Calculate expected upfront interest amount using borrower's rate
  const expectedInterest = calculateUpfrontInterest(
    parseFloat(loan.loan_amount),
    loan.borrower_interest_rate, // Raw decimal from DB (e.g., 0.1085)
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
  
  return {
    ...loan,
    // Convert decimals to percentages for frontend
    borrower_interest_rate: loan.borrower_interest_rate * 100,
    default_rate: loan.default_rate * 100,
    
    // Interest calculation details
    expected_total_interest: Math.round(expectedInterest.totalInterest * 100) / 100,
    expected_full_months_interest: Math.round(expectedInterest.fullMonthsInterest * 100) / 100,
    expected_partial_month_interest: Math.round(expectedInterest.partialMonthInterest * 100) / 100,
    
    // Payment status
    total_interest_paid: actualPaidAmount,
    interest_status: interestStatus,
    loan_status: loanStatus,
    payment_completion: loan.total_interest_paid ? 
      Math.round((actualPaidAmount / expectedInterest.totalInterest) * 100) : 0
  };
});
```

### Cashflow Route (`backend/src/routes/cashflow.js`)

#### `GET /api/cashflow/monthly` - Cashflow predictions

**Purpose**: Generates monthly cashflow predictions based on actual payment data

**Enhanced Database Query**:
```sql
SELECT 
  s.id,
  s.loan_amount,
  s.interest_rate as borrower_interest_rate,
  s.loan_start_date,
  s.loan_repayment_date,
  s.loan_expiry_date,
  p.name as project_title,
  p.id as project_id,
  COALESCE(payment_summary.total_interest_paid, 0) as total_interest_paid,
  COALESCE(payment_summary.payment_count, 0) as payment_count,
  payment_summary.last_payment_date
FROM stage s
LEFT JOIN project p ON s.project_id = p.id
LEFT JOIN (
  SELECT 
    stage_id,
    SUM(money) as total_interest_paid,
    COUNT(*) as payment_count,
    MAX(date) as last_payment_date
  FROM invest_interest 
  GROUP BY stage_id
) payment_summary ON s.id = payment_summary.stage_id
WHERE s.status IN ('operating', 'performing')
  AND (p.id IN (59, 55, 51) OR s.loan_repayment_date >= CURDATE())
```

**Loan Data Pre-processing**:
```javascript
const loanData = activeLoans.map(loan => {
  // Calculate proper expected upfront interest
  const expectedInterest = calculateUpfrontInterest(
    parseFloat(loan.loan_amount),
    loan.borrower_interest_rate,
    loan.loan_start_date,
    loan.loan_repayment_date
  );
  
  // Use actual payment amount (what borrower actually paid)
  const actualPaidAmount = parseFloat(loan.total_interest_paid || 0);
  
  // Calculate loan term in months for spreading the income
  const loanStartDate = new Date(loan.loan_start_date);
  const loanEndDate = new Date(loan.loan_repayment_date);
  const totalDays = Math.ceil((loanEndDate - loanStartDate) / (1000 * 60 * 60 * 24));
  const approximateMonths = Math.max(1, Math.round(totalDays / 30));
  
  // Calculate monthly income based on actual payments
  const monthlyIncomeFromActualPayments = actualPaidAmount / approximateMonths;
  
  return {
    ...loan,
    expectedInterest: expectedInterest.totalInterest,
    actualPaidAmount,
    approximateMonths,
    monthlyIncomeFromActualPayments,
    loanStartDate,
    loanEndDate,
    contractPeriod: expectedInterest.period
  };
});
```

**Monthly Prediction Logic**:
```javascript
for (let i = 0; i < months; i++) {
  const targetDate = new Date();
  targetDate.setMonth(targetDate.getMonth() + i);
  const monthStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
  const monthEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
  
  // Calculate monthly interest income based on actual payments spread over loan term
  for (const loan of loanData) {
    // Check if loan is active during this month
    if (loan.loanStartDate <= monthEnd && loan.loanEndDate >= monthStart) {
      // Only include income if borrower actually made payments
      if (loan.actualPaidAmount > 0) {
        monthData.totalInterestReceivable += loan.monthlyIncomeFromActualPayments;
        monthData.interestPayments.push({
          stageId: loan.id,
          projectTitle: loan.project_title,
          amount: loan.monthlyIncomeFromActualPayments,
          type: 'actual_monthly_income',
          actualPaid: loan.actualPaidAmount,
          expectedTotal: loan.expectedInterest,
          paymentStatus: loan.actualPaidAmount >= loan.expectedInterest * 0.99 ? 'fully_paid' : 'partial_paid'
        });
      }
    }
  }
}
```

### Reminders Route (`backend/src/routes/reminders.js`)

#### `GET /api/reminders` - Payment reminders

**Purpose**: Generates upcoming payment reminders for borrowers

**Key Logic**:
```javascript
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
}
```

#### `GET /api/reminders/investors` - Investor payment reminders

**Purpose**: Generates investor payment schedules with prorated calculations

**Complex Prorated Payment Logic**:
```javascript
// Calculate prorated payments for investors
const generatePaymentSchedule = (basePaymentDate, endDate, predictionEndDate, hasLastPayment = false) => {
  const payments = [];
  let currentPaymentDate = new Date(basePaymentDate);
  
  // If we have a last payment date, calculate the next payment first
  if (hasLastPayment) {
    // Next payment = last payment + 1 month - 1 day
    currentPaymentDate.setMonth(currentPaymentDate.getMonth() + 1);
    currentPaymentDate.setDate(currentPaymentDate.getDate() - 1);
  }
  
  // Generate all future payments
  while (currentPaymentDate <= new Date(endDate) && currentPaymentDate <= predictionEndDate) {
    if (currentPaymentDate >= new Date()) {
      payments.push(new Date(currentPaymentDate));
    }
    
    // Calculate next payment date
    currentPaymentDate.setMonth(currentPaymentDate.getMonth() + 1);
    currentPaymentDate.setDate(currentPaymentDate.getDate() - 1);
  }
  
  return payments;
};
```

## 🔍 Special Business Logic

### Special Project Handling (Projects 59, 55, 51)

These projects have unique business rules:

```javascript
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
  }
  
  // Normal logic for other projects...
}
```

### Payment Completion Accuracy

The system uses a 1% tolerance for payment completion to handle rounding:

```javascript
// Check if payment amount is sufficient (with 1% tolerance for rounding)
const tolerance = expectedInterest * 0.01;
const sufficientPayment = actualPaidAmount >= (expectedInterest - tolerance);

// Frontend display logic
const formatPaymentCompletion = (completion) => {
  const percentage = completion || 0;
  // If payment is more than 99.9%, show 100%
  return percentage > 99.9 ? 100 : Math.round(percentage * 100) / 100;
};
```

### Database Query Optimization

The system uses efficient SQL with subqueries and JOINs:

```sql
-- Optimized query with payment aggregation
LEFT JOIN (
  SELECT 
    stage_id,
    SUM(money) as total_interest_paid,
    COUNT(*) as payment_count,
    MAX(date) as last_payment_date
  FROM invest_interest 
  GROUP BY stage_id
) payment_summary ON s.id = payment_summary.stage_id
```

This approach:
- **Reduces Database Calls**: Aggregates payment data in a single query
- **Improves Performance**: Uses indexed foreign keys
- **Maintains Accuracy**: Preserves exact payment amounts and dates

## 🗄️ Database Structure

The system uses MySQL with these main tables:
- `project` - Project information and status
- `stage` - Loan stages with amounts and dates
- `invest_interest` - Interest payment tracking
- `invest_funding` - Investor funding records
- `account` - User and investor accounts
- `investor_payment_reminders` - Payment reminder status tracking

## 🏗️ Project Structure

```
GoodLand_W1_Dyaln/
├── backend/                    # Backend API server
│   ├── src/
│   │   ├── routes/            # API route handlers
│   │   ├── utils/             # Utility functions
│   │   └── database/          # Database connection
│   ├── server.js              # Main server entry point
│   └── package.json           # Backend dependencies
├── frontend/                   # Frontend React app
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── pages/             # Page components
│   │   └── services/          # API services
│   ├── public/                # Static assets
│   └── package.json           # Frontend dependencies
├── database/                   # Database files
│   ├── goodland_2025-06-30_02-30-02_mysql_data.sql
│   └── schema.sql
└── README.md                   # This file
```

## 🎯 Key Features Explained

### Upfront Interest Payment Model
- Borrowers pay ALL interest upfront at contract start
- Monthly cashflow predictions spread this income over loan term
- Uses actual payment data from `invest_interest` table

### Proper Interest Calculations
- Uses `calculateUpfrontInterest()` function with daily proration
- Handles full months + partial months accurately
- Accounts for different month lengths

### Payment Analysis
- Tracks actual vs expected payments
- Shows collection rates and completion percentages
- Identifies fully paid, partially paid, and unpaid loans

### Special Project Handling
- Projects 59, 55, 51 have custom overdue logic
- Always visible regardless of end dates
- Different status calculations for these projects

## 🔧 Environment Configuration

### Backend Environment Variables (.env)
```env
# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=goodland_lms
DB_PORT=3306

# Server Configuration
PORT=3001
NODE_ENV=development
```

## 🚀 Deployment

### Production Build
```bash
# Build frontend
cd frontend
npm run build

# Start backend in production mode
cd ../backend
NODE_ENV=production npm start
```

### Docker Deployment (Optional)
```dockerfile
# Example Dockerfile for backend
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

## 🧪 Testing

### Run Backend Tests
```bash
cd backend
npm test
```

### Run Frontend Tests
```bash
cd frontend
npm test
```

## 📊 System Performance

- **Database Size**: ~12MB (6.5MB data + 5.7MB schema)
- **Active Loans**: 48 loans being tracked
- **Response Time**: < 500ms for most API endpoints
- **Memory Usage**: ~50MB for backend, ~100MB for frontend

## ⚠️ Known Issues & Current Limitations

### Data Quality Issues

1. **Dirty Data - Duplicates & Anomalies**
   - **Problem**: The database contains duplicate project records and anomalous interest payment data
   - **Impact**: Some loans may appear multiple times with different amounts or payment statuses
   - **Detection**: System logs duplicate project names and unusual payment completion percentages
   - **Mitigation**: Debug endpoints available at `/api/debug/duplicates/{projectName}` to identify issues
   - **Example**: Projects with same name but different stage IDs and payment amounts

2. **Email & Phone Data Gaps**
   - **Problem**: Many investor records have null email addresses and phone numbers
   - **Impact**: Payment reminder system cannot send notifications to all investors
   - **Affected Function**: `/api/reminders/investors` returns incomplete contact information
   - **Current Behavior**: System continues to generate reminders but marks contact info as unavailable
   - **Required Fix**: Data cleanup to populate missing contact information

3. **Status Classification Issues**
   - **Problem**: 3+ loan records incorrectly marked as 'overdue' due to status logic conflicts
   - **Root Cause**: The 'operating' term filtering is not working properly for certain edge cases
   - **Impact**: False alarms in loan status reports and cashflow predictions
   - **Affected Logic**: Special project handling (IDs 59, 55, 51) vs normal loan status calculations
   - **Debug Tools**: Use `/api/debug/loans/{projectTitle}` to investigate specific cases

### System Limitations

4. **Interest Calculation Edge Cases**
   - **Partial Month Proration**: May have rounding errors for contracts starting/ending mid-month
   - **Special Projects**: Projects 59, 55, 51 have hardcoded business rules that may not apply universally
   - **Payment Tolerance**: 1% tolerance for payment completion may be too strict/loose for some cases

5. **Performance Considerations**
   - **Large Data Sets**: Cashflow predictions may be slow with 100+ active loans
   - **Database Queries**: Some queries use subqueries instead of JOINs for payment aggregation
   - **Memory Usage**: Frontend may consume significant memory when displaying all loan details

6. **Business Logic Assumptions**
   - **Upfront Payment Model**: System assumes all borrower interest is paid upfront
   - **Fixed Rate Calculations**: No support for variable interest rates or rate changes
   - **Currency**: All calculations assume AUD with no multi-currency support

## 🔧 Data Cleanup Recommendations

### Immediate Actions Required

1. **Duplicate Data Cleanup**
   ```sql
   -- Identify duplicate projects
   SELECT name, COUNT(*) as count 
   FROM project 
   GROUP BY name 
   HAVING COUNT(*) > 1;
   
   -- Review duplicate loan stages
   SELECT project_id, COUNT(*) as loan_count, SUM(loan_amount) as total_amount
   FROM stage 
   WHERE status IN ('operating', 'performing')
   GROUP BY project_id 
   HAVING COUNT(*) > 1;
   ```

2. **Contact Information Update**
   ```sql
   -- Find investors with missing contact info
   SELECT id, name, email, phone 
   FROM account 
   WHERE (email IS NULL OR email = '') 
      OR (phone IS NULL OR phone = '');
   ```

3. **Status Logic Audit**
   ```sql
   -- Review potentially misclassified loans
   SELECT s.id, p.name, s.status, s.loan_repayment_date, s.loan_expiry_date
   FROM stage s 
   JOIN project p ON s.project_id = p.id
   WHERE s.status = 'operating' 
     AND s.loan_repayment_date < CURDATE()
     AND p.id NOT IN (59, 55, 51);
   ```

### Development Priorities

1. **Data Validation Layer**: Add checks for duplicate prevention and data integrity
2. **Contact Information Validation**: Require email/phone for investor registration
3. **Status Logic Refactoring**: Simplify and standardize loan status calculations
4. **Automated Data Quality Reports**: Daily checks for data inconsistencies

## 🔍 Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Check MySQL service is running
   - Verify credentials in `.env` file
   - Ensure database `goodland_lms` exists

2. **Import Fails**
   - Check file path to `goodland_2025-06-30_02-30-02_mysql_data.sql`
   - Ensure sufficient disk space
   - Try importing in smaller chunks if needed

3. **API Endpoints Not Working**
   - Check backend server is running on port 3001
   - Verify CORS settings allow frontend domain
   - Check console for detailed error messages

4. **Frontend Build Errors**
   - Clear node_modules: `rm -rf node_modules && npm install`
   - Check Node.js version compatibility
   - Verify all dependencies are installed

5. **Incorrect Loan Status or Payment Data**
   - Use debug endpoints to investigate: `/api/debug/loans/{projectTitle}`
   - Check for duplicate records: `/api/debug/duplicates/{projectName}`
   - Verify payment synchronization: `/api/debug/payment-sync/{projectName}`

6. **Missing Reminder Notifications**
   - Check investor contact information in database
   - Verify email/phone fields are populated
   - Review reminder generation logs in console output

## 📞 Support

For issues and questions:
1. Check the troubleshooting section above
2. Review API endpoint documentation
3. Check debug endpoints for system insights
4. Review console logs for detailed error messages

## 🔄 Updates and Maintenance

### Regular Tasks
- Monitor database size growth
- Check for duplicate project records
- Verify payment synchronization
- Update investor payment schedules

### Performance Monitoring
- Use `/api/debug/` endpoints for system insights
- Monitor API response times
- Check database query performance
- Review memory usage patterns

## 📋 Changelog & Development Notes

### Version 2.1.0 (Current) - 2025-07-01
**Status**: Development with Known Issues

**New Features:**
- Enhanced cashflow predictions with NET vs GROSS calculations
- Comprehensive tax and fee tracking
- Payment analysis with collection rates
- Actual payment data integration instead of theoretical calculations

**Known Issues Documented:**
- Dirty data: Duplicate projects and anomalous payment records
- Missing contact information affecting reminder system
- Status classification issues with 3+ loans incorrectly marked as overdue
- Performance considerations with large datasets

**Debug Tools Added:**
- `/api/debug/duplicates/{projectName}` - Identify duplicate records
- `/api/debug/loans/{projectTitle}` - Investigate loan calculations  
- `/api/debug/payment-sync/{projectName}` - Payment synchronization issues

### Version 2.0.0 - 2025-06-30
**Status**: Stable

**Major Changes:**
- Implemented upfront interest payment model
- Added special project handling (IDs 59, 55, 51)
- Modular backend architecture
- Payment completion percentage calculations
- Daily proration for partial months

### Version 1.0.0 - Initial Release
**Status**: Legacy

**Features:**
- Basic loan management
- Simple payment tracking
- Basic investor reminders

## 🎯 Development Roadmap

### Phase 1: Data Quality (Priority: High)
- [ ] Implement duplicate detection and prevention
- [ ] Data cleanup procedures for existing records
- [ ] Contact information validation layer
- [ ] Automated data quality reports

### Phase 2: System Reliability (Priority: High)  
- [ ] Fix loan status classification logic
- [ ] Improve special project handling
- [ ] Performance optimization for large datasets
- [ ] Enhanced error handling and logging

### Phase 3: Feature Enhancements (Priority: Medium)
- [ ] Multi-currency support
- [ ] Variable interest rate handling
- [ ] Advanced reporting and analytics
- [ ] Email notification system integration

### Phase 4: User Experience (Priority: Low)
- [ ] Advanced filtering and search
- [ ] Export functionality
- [ ] Mobile-responsive improvements
- [ ] User role management

---

**Version**: 2.1.0-dev  
**Status**: Development with Known Issues  
**Last Updated**: 2025-07-01  
**Maintainer**: Dylan (Goodland Team)  

**⚠️ Production Notice**: This system contains known data quality issues. Review the "Known Issues" section before deploying to production environments. 
