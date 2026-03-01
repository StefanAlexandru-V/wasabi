"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

export type TabValue = "overview" | "repositories" | "history";

interface TabsContextValue {
  activeTab: TabValue;
  setActiveTab: (tab: TabValue) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error("Tab components must be used within a Tabs provider");
  }
  return context;
}

interface TabsProps {
  defaultTab?: TabValue;
  children: ReactNode;
  onTabChange?: (tab: TabValue, setTab: (tab: TabValue) => void) => void;
}

export function Tabs({ defaultTab = "overview", children, onTabChange }: TabsProps) {
  const [activeTab, setActiveTabState] = useState<TabValue>(defaultTab);

  // Sync with URL on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const urlTab = params.get("tab") as TabValue | null;
    if (urlTab && ["overview", "repositories", "history"].includes(urlTab)) {
      setActiveTabState(urlTab);
    }
  }, []);

  const setActiveTab = useCallback((tab: TabValue) => {
    setActiveTabState(tab);
    onTabChange?.(tab, setActiveTabState);
    
    // Update URL without navigation
    if (typeof window !== "undefined" && window.location.href) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("tab", tab);
        window.history.replaceState({}, "", url.toString());
      } catch {
        // URL parsing can fail in test environments
      }
    }
  }, [onTabChange]);

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      {children}
    </TabsContext.Provider>
  );
}

interface TabListProps {
  children: ReactNode;
  className?: string;
}

export function TabList({ children, className = "" }: TabListProps) {
  return (
    <div 
      role="tablist" 
      aria-label="Dashboard sections"
      className={`grid grid-cols-3 sm:inline-flex sm:items-center gap-1 p-1 rounded-lg bg-surface-2 border border-border-subtle ${className}`}
    >
      {children}
    </div>
  );
}

interface TabTriggerProps {
  value: TabValue;
  children: ReactNode;
  icon?: ReactNode;
  badge?: number;
}

export function TabTrigger({ value, children, icon, badge }: TabTriggerProps) {
  const { activeTab, setActiveTab } = useTabsContext();
  const isActive = activeTab === value;

  return (
    <button
      role="tab"
      aria-selected={isActive}
      aria-controls={`tabpanel-${value}`}
      id={`tab-${value}`}
      onClick={() => setActiveTab(value)}
      className={`
        relative flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50
        ${isActive 
          ? "bg-surface-0 text-text-primary shadow-sm" 
          : "text-text-tertiary hover:text-text-secondary hover:bg-surface-3/50"
        }
      `}
    >
      {icon && <span className="shrink-0 hidden sm:block">{icon}</span>}
      <span className="truncate">{children}</span>
      {typeof badge === "number" && badge > 0 && (
        <span className={`
          inline-flex items-center justify-center min-w-[14px] sm:min-w-[18px] h-[14px] sm:h-[18px] px-0.5 sm:px-1 text-[10px] sm:text-xs font-bold rounded-full shrink-0
          ${isActive ? "bg-accent text-white text-on-color" : "bg-surface-4 text-text-tertiary"}
        `}>
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
}

interface TabContentProps {
  value: TabValue;
  children: ReactNode;
  className?: string;
}

export function TabContent({ value, children, className = "" }: TabContentProps) {
  const { activeTab } = useTabsContext();
  
  if (activeTab !== value) return null;

  return (
    <div
      role="tabpanel"
      id={`tabpanel-${value}`}
      aria-labelledby={`tab-${value}`}
      className={`animate-fade-in ${className}`}
    >
      {children}
    </div>
  );
}

// Hook to access tab state from child components
export function useActiveTab() {
  const { activeTab, setActiveTab } = useTabsContext();
  return { activeTab, setActiveTab };
}
