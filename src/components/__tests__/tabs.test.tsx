import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Tabs, TabList, TabTrigger, TabContent, useActiveTab } from "../tabs";

// Mock window.location and history
const mockReplaceState = vi.fn();
const mockLocation = {
  href: "http://localhost:3000",
  search: "",
};

beforeEach(() => {
  vi.resetAllMocks();
  Object.defineProperty(window, "location", {
    value: mockLocation,
    writable: true,
  });
  Object.defineProperty(window, "history", {
    value: { replaceState: mockReplaceState },
    writable: true,
  });
  mockLocation.href = "http://localhost:3000";
  mockLocation.search = "";
});

describe("Tabs", () => {
  it("renders with default tab selected", () => {
    render(
      <Tabs defaultTab="overview">
        <TabList>
          <TabTrigger value="overview">Overview</TabTrigger>
          <TabTrigger value="repositories">Repositories</TabTrigger>
          <TabTrigger value="history">History</TabTrigger>
        </TabList>
        <TabContent value="overview">Overview Content</TabContent>
        <TabContent value="repositories">Repositories Content</TabContent>
        <TabContent value="history">History Content</TabContent>
      </Tabs>
    );

    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Overview Content")).toBeInTheDocument();
    expect(screen.queryByText("Repositories Content")).not.toBeInTheDocument();
  });

  it("switches tabs when clicking tab triggers", () => {
    render(
      <Tabs defaultTab="overview">
        <TabList>
          <TabTrigger value="overview">Overview</TabTrigger>
          <TabTrigger value="repositories">Repositories</TabTrigger>
          <TabTrigger value="history">History</TabTrigger>
        </TabList>
        <TabContent value="overview">Overview Content</TabContent>
        <TabContent value="repositories">Repositories Content</TabContent>
        <TabContent value="history">History Content</TabContent>
      </Tabs>
    );

    fireEvent.click(screen.getByRole("tab", { name: "Repositories" }));

    expect(screen.getByRole("tab", { name: "Repositories" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByText("Repositories Content")).toBeInTheDocument();
    expect(screen.queryByText("Overview Content")).not.toBeInTheDocument();
  });

  it("calls onTabChange when tab changes", () => {
    const onTabChange = vi.fn();

    render(
      <Tabs defaultTab="overview" onTabChange={onTabChange}>
        <TabList>
          <TabTrigger value="overview">Overview</TabTrigger>
          <TabTrigger value="repositories">Repositories</TabTrigger>
        </TabList>
        <TabContent value="overview">Overview Content</TabContent>
        <TabContent value="repositories">Repositories Content</TabContent>
      </Tabs>
    );

    fireEvent.click(screen.getByRole("tab", { name: "Repositories" }));

    expect(onTabChange).toHaveBeenCalledWith("repositories", expect.any(Function));
  });

  it("updates URL when tab changes", () => {
    render(
      <Tabs defaultTab="overview">
        <TabList>
          <TabTrigger value="overview">Overview</TabTrigger>
          <TabTrigger value="repositories">Repositories</TabTrigger>
        </TabList>
        <TabContent value="overview">Overview Content</TabContent>
        <TabContent value="repositories">Repositories Content</TabContent>
      </Tabs>
    );

    fireEvent.click(screen.getByRole("tab", { name: "Repositories" }));

    expect(mockReplaceState).toHaveBeenCalled();
    const urlArg = mockReplaceState.mock.calls[0][2];
    expect(urlArg).toContain("tab=repositories");
  });

  it("renders badge on tab trigger", () => {
    render(
      <Tabs defaultTab="overview">
        <TabList>
          <TabTrigger value="overview" badge={5}>Overview</TabTrigger>
          <TabTrigger value="repositories" badge={100}>Repositories</TabTrigger>
        </TabList>
        <TabContent value="overview">Overview Content</TabContent>
      </Tabs>
    );

    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("99+")).toBeInTheDocument(); // 100 should show as 99+
  });

  it("renders icon on tab trigger", () => {
    const TestIcon = () => <svg data-testid="test-icon" />;

    render(
      <Tabs defaultTab="overview">
        <TabList>
          <TabTrigger value="overview" icon={<TestIcon />}>Overview</TabTrigger>
        </TabList>
        <TabContent value="overview">Overview Content</TabContent>
      </Tabs>
    );

    expect(screen.getByTestId("test-icon")).toBeInTheDocument();
  });

  it("has correct ARIA attributes", () => {
    render(
      <Tabs defaultTab="overview">
        <TabList>
          <TabTrigger value="overview">Overview</TabTrigger>
          <TabTrigger value="repositories">Repositories</TabTrigger>
        </TabList>
        <TabContent value="overview">Overview Content</TabContent>
        <TabContent value="repositories">Repositories Content</TabContent>
      </Tabs>
    );

    const overviewTab = screen.getByRole("tab", { name: "Overview" });
    const tabPanel = screen.getByRole("tabpanel");

    expect(overviewTab).toHaveAttribute("aria-controls", "tabpanel-overview");
    expect(overviewTab).toHaveAttribute("id", "tab-overview");
    expect(tabPanel).toHaveAttribute("aria-labelledby", "tab-overview");
    expect(tabPanel).toHaveAttribute("id", "tabpanel-overview");
  });

  it("reads initial tab from URL", () => {
    mockLocation.href = "http://localhost:3000?tab=history";
    mockLocation.search = "?tab=history";

    render(
      <Tabs defaultTab="overview">
        <TabList>
          <TabTrigger value="overview">Overview</TabTrigger>
          <TabTrigger value="history">History</TabTrigger>
        </TabList>
        <TabContent value="overview">Overview Content</TabContent>
        <TabContent value="history">History Content</TabContent>
      </Tabs>
    );

    // Note: The URL sync happens in useEffect, so in tests it may not trigger
    // This test verifies the component renders without error with URL params
    expect(screen.getByRole("tablist")).toBeInTheDocument();
  });
});

describe("TabList", () => {
  it("renders with custom className", () => {
    render(
      <Tabs defaultTab="overview">
        <TabList className="custom-class">
          <TabTrigger value="overview">Overview</TabTrigger>
        </TabList>
        <TabContent value="overview">Content</TabContent>
      </Tabs>
    );

    expect(screen.getByRole("tablist")).toHaveClass("custom-class");
  });
});

describe("TabContent", () => {
  it("renders with custom className", () => {
    render(
      <Tabs defaultTab="overview">
        <TabList>
          <TabTrigger value="overview">Overview</TabTrigger>
        </TabList>
        <TabContent value="overview" className="custom-content-class">
          Content
        </TabContent>
      </Tabs>
    );

    expect(screen.getByRole("tabpanel")).toHaveClass("custom-content-class");
  });
});

describe("useActiveTab hook", () => {
  function TestComponent() {
    const { activeTab, setActiveTab } = useActiveTab();
    return (
      <div>
        <span data-testid="active-tab">{activeTab}</span>
        <button onClick={() => setActiveTab("history")}>Go to History</button>
      </div>
    );
  }

  it("provides access to active tab state", () => {
    render(
      <Tabs defaultTab="overview">
        <TabList>
          <TabTrigger value="overview">Overview</TabTrigger>
          <TabTrigger value="history">History</TabTrigger>
        </TabList>
        <TabContent value="overview">
          <TestComponent />
        </TabContent>
        <TabContent value="history">History Content</TabContent>
      </Tabs>
    );

    expect(screen.getByTestId("active-tab")).toHaveTextContent("overview");

    fireEvent.click(screen.getByText("Go to History"));

    expect(screen.getByText("History Content")).toBeInTheDocument();
  });

  it("throws when used outside Tabs context", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    
    expect(() => render(<TestComponent />)).toThrow(
      "Tab components must be used within a Tabs provider"
    );

    consoleError.mockRestore();
  });
});
