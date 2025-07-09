import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Box,
  Paper
} from '@mui/material';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';

function Layout({ children }) {
  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <AccountBalanceIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Goodland Capital - Loan Management System
          </Typography>
          <Typography variant="body2">
            {new Date().toLocaleDateString()}
          </Typography>
        </Toolbar>
      </AppBar>
      
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Paper elevation={3} sx={{ p: 3 }}>
          {children}
        </Paper>
      </Container>
    </Box>
  );
}

export default Layout;