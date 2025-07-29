export class TabController {
  private tabNav: HTMLElement;
  private tabContent: HTMLElement;

  constructor(tabNav: HTMLElement, tabContent: HTMLElement) {
    this.tabNav = tabNav;
    this.tabContent = tabContent;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.tabNav.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      const button = target.closest(".tab-btn");
      if (!button) return;

      const tabId = (button as HTMLElement).dataset.tab;
      if (!tabId) return;

      this.activateTab(tabId);
    });
  }

  private activateTab(tabId: string): void {
    // Deactivate all tabs and panes
    this.tabNav.querySelectorAll(".tab-btn").forEach((btn) => btn.classList.remove("active"));
    document.querySelectorAll(".tab-pane").forEach((pane) => pane.classList.remove("active"));

    // Activate the clicked tab and its corresponding pane
    const tabButton = this.tabNav.querySelector(`[data-tab="${tabId}"]`);
    if (tabButton) {
      tabButton.classList.add("active");
    }

    const activePane = document.getElementById(tabId);
    if (activePane) {
      activePane.classList.add("active");
    }
  }

  getActiveTabId(): string | null {
    const activeButton = this.tabNav.querySelector(".tab-btn.active") as HTMLElement;
    return activeButton ? activeButton.dataset.tab || null : null;
  }

  setActiveTab(tabId: string): void {
    this.activateTab(tabId);
  }
}