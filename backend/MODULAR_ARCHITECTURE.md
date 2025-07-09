# Goodland LMS Backend - Modular Architecture

## Overview

The backend has been refactored from a single large `server.js` file into a modular architecture for better maintainability, scalability, and organization.

## Directory Structure

```
backend/
├── server.js                     # Original monolithic server (backup)
├── server_refactored.js         # New modular server entry point
├── src/
│   ├── routes/                   # API route modules
│   │   ├── loans.js             # Loan-related endpoints
│   │   ├── reminders.js         # Reminder endpoints (general + investor)
│   │   ├── cashflow.js          # Cashflow endpoints
│   │   └── debug.js             # Debug and testing endpoints
│   ├── utils/                   # Utility functions
│   │   └── calculations.js      # Financial calculation functions
│   ├── controllers/             # Business logic controllers
│   ├── middleware/              # Custom middleware functions
│   ├── models/                  # Data models
│   ├── services/                # Business services
│   └── database/                # Database connection and utilities
│       └── connection.js
└── package.json
```

## Route Modules

### 1. **Loans Routes** (`src/routes/loans.js`)
- **GET** `/api/loans` - Get all active loans with interest calculations
- Features: Upfront interest calculations, loan status tracking, special project handling

### 2. **Reminders Routes** (`src/routes/reminders.js`)
- **GET** `/api/reminders` - Get general payment reminders (borrower payments)
- **GET** `/api/reminders/investors` - Get investor payment reminders (with prorated calculations)
- **POST** `/api/reminders/investors/mark-status` - Mark investor payments as paid/ignored
- Features: Prorated final payments, payment synchronization, 3-year data retention

### 3. **Cashflow Routes** (`src/routes/cashflow.js`)
- **GET** `/api/cashflow/monthly` - Get monthly cashflow data
- Features: Historical analysis, payment tracking

### 4. **Debug Routes** (`src/routes/debug.js`)
- **GET** `/api/debug/payment-sync/:projectName` - Investigate payment synchronization issues
- **GET** `/api/debug/prorated-payments/:stageId/:investorId` - Test prorated payment calculations
- **GET** `/api/debug/duplicates/:projectName` - Check for duplicate project records

## Utility Modules

### 1. **Calculations** (`src/utils/calculations.js`)
Contains all financial calculation functions:
- `calculateContractPeriod()` - Calculate loan periods
- `calculateUpfrontInterest()` - Calculate borrower interest payments
- `getUpfrontInterestStatus()` - Determine payment status
- `calculateBasePaymentDate()` - Calculate investor payment start dates
- `generatePaymentSchedule()` - Generate investor payment schedules
- `getLoanStatus()` - Determine loan status with special project handling

## Key Features

### ✅ **Prorated Final Payments**
- Automatically detects final payments at end of investment terms
- Calculates daily rates: `((annual_rate / 12) / days_in_month) × remaining_days`
- Only prorates when remaining days < 30
- Frontend displays "Prorated (X days)" badges

### ✅ **Payment Synchronization Debug**
- Investigates why investors in the same project have different payment dates
- Analyzes transaction dates, start dates, and payment histories
- Identifies synchronization issues automatically

### ✅ **Enhanced Security & Performance**
- Helmet.js for security headers
- Rate limiting (1000 requests per 15 minutes)
- Request compression
- Graceful shutdown handling
- Comprehensive error handling

## How to Switch to Modular Architecture

### Option 1: Gradual Migration (Recommended)
1. **Test the new structure:**
   ```bash
   # Rename current server for backup
   mv server.js server_original.js
   
   # Use the new modular server
   mv server_refactored.js server.js
   
   # Start the server
   npm start
   ```

2. **Verify all endpoints work:**
   - http://localhost:3001/api/health
   - http://localhost:3001/api/loans
   - http://localhost:3001/api/reminders/investors
   - http://localhost:3001/api/debug/payment-sync/Urban%20Loop

3. **Roll back if needed:**
   ```bash
   mv server.js server_modular.js
   mv server_original.js server.js
   ```

### Option 2: Side-by-Side Testing
1. Keep both versions and test on different ports
2. Compare responses between modular and original versions
3. Switch when confident

## Benefits of Modular Architecture

### 🎯 **Maintainability**
- Each route module is focused on a specific domain
- Easy to find and modify specific functionality
- Clear separation of concerns

### 🚀 **Scalability**
- Easy to add new route modules
- Utility functions can be reused across modules
- Better testing isolation

### 🔧 **Development Experience**
- Smaller files are easier to navigate
- Reduced merge conflicts in team development
- Clear module boundaries

### 📊 **Debugging**
- Dedicated debug routes for troubleshooting
- Modular error handling
- Better logging and monitoring

## Testing the New Architecture

### Test Payment Synchronization Issue
```bash
# Test the Urban Loop payment sync issue
curl "http://localhost:3001/api/debug/payment-sync/Urban%20Loop" | jq

# Expected: Detailed analysis of why Goodland Capital and Chen Gui have different payment dates
```

### Test Prorated Payments
```bash
# Test prorated payment calculations
curl "http://localhost:3001/api/debug/prorated-payments/83/5" | jq

# Expected: Various scenarios showing prorated vs standard payments
```

### Test Standard Functionality
```bash
# Test investor reminders (should work exactly the same)
curl "http://localhost:3001/api/reminders/investors?days=60" | jq

# Expected: Same data as before, but with prorated payment support
```

## Migration Checklist

- [ ] Backup original `server.js`
- [ ] Install any missing dependencies
- [ ] Test all existing API endpoints
- [ ] Verify frontend still works
- [ ] Test new debug endpoints
- [ ] Verify prorated payment calculations
- [ ] Test payment marking functionality
- [ ] Monitor for any errors in logs
- [ ] Update deployment scripts if needed

## Future Enhancements

With the modular architecture, future improvements can be easily added:

1. **Authentication middleware** in `src/middleware/auth.js`
2. **Data validation** in `src/middleware/validation.js`
3. **Caching layer** in `src/services/cache.js`
4. **Advanced cashflow analysis** in `src/routes/analytics.js`
5. **Automated testing** with isolated route testing

## Support

If you encounter any issues after switching to the modular architecture:

1. Check the server logs for specific error messages
2. Use the debug endpoints to troubleshoot payment issues
3. Roll back to the original `server.js` if critical issues occur
4. Compare responses between old and new versions

The modular architecture maintains 100% backward compatibility while adding new features and improved maintainability. 