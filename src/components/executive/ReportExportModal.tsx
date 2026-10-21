import React from 'react';
import { LgaReportExportCentre } from '../reports/LgaReportExportCentre';

interface ReportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultLgaId?: string;
}

/**
 * ReportExportModal delegates to the comprehensive LGA Report Export Centre,
 * providing multi-sheet Excel (.xlsx), official PDF, and sanitised CSV exports
 * with role-based data security and full demographic breakdowns.
 */
export const ReportExportModal: React.FC<ReportExportModalProps> = ({
  isOpen,
  onClose,
  defaultLgaId,
}) => {
  return (
    <LgaReportExportCentre
      isOpen={isOpen}
      onClose={onClose}
      defaultLgaId={defaultLgaId}
    />
  );
};
