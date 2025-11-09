/**
 * Utility functions for consistent number formatting across server and client
 */

/**
 * Format number with Indian locale formatting (lakhs/crores)
 * This ensures consistent formatting between server and client
 */
export function formatIndianCurrency(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return '0';
  }
  
  // Use Indian locale for consistent formatting
  return amount.toLocaleString('en-IN');
}

/**
 * Format number with standard locale formatting
 * This ensures consistent formatting between server and client
 */
export function formatNumber(num: number): string {
  if (isNaN(num) || num === null || num === undefined) {
    return '0';
  }
  
  // Use en-US locale for consistent formatting
  return num.toLocaleString('en-US');
}

/**
 * Format currency with Indian Rupee symbol
 */
export function formatCurrency(amount: number): string {
  return `₹${formatIndianCurrency(amount)}`;
}

/**
 * Format percentage
 */
export function formatPercentage(value: number, decimals: number = 2): string {
  if (isNaN(value) || value === null || value === undefined) {
    return '0%';
  }
  
  return `${value.toFixed(decimals)}%`;
}



