import React from 'react';
import { cn } from '../lib/utils';

interface FiapLogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  animated?: boolean;
  className?: string;
}

export function FiapLogo({ animated, className, ...props }: FiapLogoProps) {
  return (
    <img 
      src="/assets/fiap-logo.png"
      alt="FIAP Logo"
      className={cn("object-contain", animated && "animate-spin opacity-80", className)}
      {...props}
    />
  );
}
