import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface CardTitleProps {
  children: React.ReactNode;
  className?: string;
}

interface CardDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

interface CardContentProps {
  children: React.ReactNode;
  className?: string;
}

interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> & {
  Header: React.FC<CardHeaderProps>;
  Title: React.FC<CardTitleProps>;
  Description: React.FC<CardDescriptionProps>;
  Content: React.FC<CardContentProps>;
  Footer: React.FC<CardFooterProps>;
} = ({ children, className = "" }) => (
  <div
    className={`rounded-lg border border-border bg-card text-card-foreground shadow-sm ${className}`}
  >
    {children}
  </div>
);

Card.Header = ({ children, className = "" }) => (
  <div className={`flex flex-col space-y-1.5 p-6 ${className}`}>{children}</div>
);

Card.Title = ({ children, className = "" }) => (
  <h2 className={`text-2xl font-semibold leading-none tracking-tight ${className}`}>
    {children}
  </h2>
);

Card.Description = ({ children, className = "" }) => (
  <p className={`text-sm text-muted-foreground ${className}`}>{children}</p>
);

Card.Content = ({ children, className = "" }) => (
  <div className={`p-6 pt-0 ${className}`}>{children}</div>
);

Card.Footer = ({ children, className = "" }) => (
  <div
    className={`flex items-center border-t border-border p-6 ${className}`}
  >
    {children}
  </div>
);
