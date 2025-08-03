export class TabController {
  private tabNav: HTMLElement;
  private tabContent: HTMLElement;
  private tabNavContainer: HTMLElement;
  private leftScrollBtn: HTMLElement;
  private rightScrollBtn: HTMLElement;
  private isDragging: boolean = false;
  private startX: number = 0;
  private scrollLeft: number = 0;

  constructor(tabNav: HTMLElement, tabContent: HTMLElement) {
    this.tabNav = tabNav;
    this.tabContent = tabContent;
    this.tabNavContainer = tabNav.parentElement as HTMLElement;
    this.leftScrollBtn = document.getElementById("tabScrollLeft") as HTMLElement;
    this.rightScrollBtn = document.getElementById("tabScrollRight") as HTMLElement;
    this.setupEventListeners();
    this.updateScrollButtons();
  }

  private setupEventListeners(): void {
    // Tab click handlers
    this.tabNav.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      const button = target.closest(".tab-btn");
      if (!button) return;

      const tabId = (button as HTMLElement).dataset.tab;
      if (!tabId) return;

      this.activateTab(tabId);
    });

    // Scroll button handlers
    this.leftScrollBtn.addEventListener("click", () => {
      this.scrollTabs(-100);
    });

    this.rightScrollBtn.addEventListener("click", () => {
      this.scrollTabs(100);
    });

    // Scroll event to update button states
    this.tabNav.addEventListener("scroll", () => {
      this.updateScrollButtons();
    });

    // Drag to scroll functionality
    this.tabNav.addEventListener("mousedown", (e) => {
      this.isDragging = true;
      this.startX = e.pageX - this.tabNav.offsetLeft;
      this.scrollLeft = this.tabNav.scrollLeft;
      this.tabNav.style.cursor = "grabbing";
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (!this.isDragging) return;
      e.preventDefault();
      const x = e.pageX - this.tabNav.offsetLeft;
      const walk = (x - this.startX) * 2;
      this.tabNav.scrollLeft = this.scrollLeft - walk;
    });

    document.addEventListener("mouseup", () => {
      this.isDragging = false;
      this.tabNav.style.cursor = "default";
    });

    // Prevent text selection during drag
    this.tabNav.addEventListener("selectstart", (e) => {
      if (this.isDragging) e.preventDefault();
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

  private scrollTabs(amount: number): void {
    this.tabNav.scrollBy({
      left: amount,
      behavior: "smooth"
    });
  }

  private updateScrollButtons(): void {
    const { scrollLeft, scrollWidth, clientWidth } = this.tabNav;
    
    // Update left button state
    if (this.leftScrollBtn) {
      this.leftScrollBtn.disabled = scrollLeft <= 0;
    }
    
    // Update right button state
    if (this.rightScrollBtn) {
      this.rightScrollBtn.disabled = scrollLeft >= scrollWidth - clientWidth - 1;
    }
  }
}