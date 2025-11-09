'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Siren, AlertTriangle, CheckCircle } from 'lucide-react';

interface PriorityAlertProps {
  level: 'high' | 'medium' | 'low';
  message: string;
}

const alertConfig = {
  high: {
    Icon: Siren,
    classes: 'bg-red-500/10 border-red-500/30 text-red-300',
  },
  medium: {
    Icon: AlertTriangle,
    classes: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300',
  },
  low: {
    Icon: CheckCircle,
    classes: 'bg-green-500/10 border-green-500/30 text-green-300',
  },
};

const PriorityAlert: React.FC<PriorityAlertProps> = ({ level, message }) => {
  const { Icon, classes } = alertConfig[level];

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`flex items-center gap-4 p-4 rounded-lg border ${classes}`}
    >
      <Icon className="h-6 w-6" />
      <p className="font-medium">{message}</p>
    </motion.div>
  );
};

export default PriorityAlert;
