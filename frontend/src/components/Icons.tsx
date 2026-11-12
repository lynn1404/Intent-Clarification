import React from 'react';

interface IconProps {
  className?: string;
}

export const SendIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <path fill="currentColor" d="M3.4 20.4 21 12 3.4 3.6 3.4 10.1 15 12 3.4 13.9z" />
  </svg>
);

export const BookIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <path
      fill="currentColor"
      d="M12 6.5C10.3 5.3 8 4.8 5 5v13c3 0 5.3.5 7 1.7 1.7-1.2 4-1.7 7-1.7V5c-3-.2-5.3.3-7 1.5zm-1 10.6C9.6 16.4 8 16.1 7 16V7c1.5 0 2.8.4 4 1.1v9zm6-1.1c-1 .1-2.6.4-4 1.1v-9c1.2-.7 2.5-1.1 4-1.1v9z"
    />
  </svg>
);

export const BoltIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <path fill="currentColor" d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
  </svg>
);
