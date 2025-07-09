import React, { useState } from 'react';
import { Box, Tabs, Tab, Typography } from '@mui/material';
import LoanStatusTab from '../components/Dashboard/LoanStatusTab';
import CashFlowTab from '../components/CashFlow/CashFlowTab';
import RemindersTab from '../components/Reminders/RemindersTab';
import InvestorRemindersTab from '../components/Reminders/InvestorRemindersTab';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

function Dashboard() {
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="h4" gutterBottom>
        Loan Management Dashboard
      </Typography>
      
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab label="Loan Status Overview" />
          <Tab label="Cashflow Prediction" />
          <Tab label="Borrower Reminders" />
          <Tab label="Investor Reminders" />
        </Tabs>
      </Box>
      
      <TabPanel value={activeTab} index={0}>
        <LoanStatusTab />
      </TabPanel>
      
      <TabPanel value={activeTab} index={1}>
        <CashFlowTab />
      </TabPanel>
      
      <TabPanel value={activeTab} index={2}>
        <RemindersTab />
      </TabPanel>
      
      <TabPanel value={activeTab} index={3}>
        <InvestorRemindersTab />
      </TabPanel>
    </Box>
  );
}

export default Dashboard;