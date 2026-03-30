import { useState } from 'react';
import { cn } from '@/lib/utils';

interface TabsProps {
  defaultValue: string;
  children: React.ReactNode;
  className?: string;
}

interface TabsListProps {
  children: React.ReactNode;
  className?: string;
}

interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  className?: string;
  activeTab?: string;
  onTabChange?: (value: string) => void;
}

interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
  activeTab?: string;
}

export function Tabs({ defaultValue, children, className }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultValue);

  return (
    <div className={cn('w-full', className)} data-active-tab={activeTab}>
      {Array.isArray(children)
        ? children.map((child: any) =>
            child?.type
              ? { ...child, props: { ...child.props, activeTab, onTabChange: setActiveTab } }
              : child
          )
        : children}
    </div>
  );
}

export function TabsList({ children, className, ...props }: TabsListProps & { activeTab?: string; onTabChange?: (v: string) => void }) {
  return (
    <div className={cn('inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground', className)}>
      {Array.isArray(children)
        ? children.map((child: any) =>
            child?.type
              ? { ...child, props: { ...child.props, activeTab: (props as any).activeTab, onTabChange: (props as any).onTabChange } }
              : child
          )
        : children}
    </div>
  );
}

export function TabsTrigger({ value, children, className, activeTab, onTabChange }: TabsTriggerProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all',
        activeTab === value
          ? 'bg-background text-foreground shadow-sm'
          : 'hover:bg-background/50',
        className
      )}
      onClick={() => onTabChange?.(value)}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children, className, activeTab }: TabsContentProps) {
  if (activeTab !== value) return null;
  return <div className={cn('mt-2', className)}>{children}</div>;
}
