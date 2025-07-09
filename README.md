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

---

**Version**: 2.0.0  
**Last Updated**: 2025-07-01  
**Maintainer**: Dylan (Goodland Team)
