import { lazy, Suspense, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "./ui/separator";
import { Button } from "./ui/button";
import { Link, useLocation } from "react-router-dom";
import useWorkspaceId from "@/hooks/use-workspace-id";
import NotificationCenter from "./notifications/notification-center";
import ActiveTimerChip from "./productivity/active-timer-chip";

const GlobalSearchCommand = lazy(() => import("./search/global-search-command"));

const Header = () => {
  const location = useLocation();
  const workspaceId = useWorkspaceId();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchChunkRequested, setSearchChunkRequested] = useState(false);

  const pathname = location.pathname;

  const openSearch = () => {
    setSearchChunkRequested(true);
    setSearchOpen(true);
  };

  const handleSearchOpenChange = (open: boolean) => {
    if (open) {
      setSearchChunkRequested(true);
    }
    setSearchOpen(open);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchChunkRequested(true);
        setSearchOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const getPageLabel = (pathname: string) => {
    if (pathname.includes("/project/")) return "Project";
    if (pathname.includes("/profile")) return "Profile";
    if (pathname.includes("/settings")) return "Settings";
    if (pathname.includes("/tasks")) return "Tasks";
    if (pathname.includes("/members")) return "Members";
    if (pathname.includes("/timeline")) return "Timeline";
    if (pathname.includes("/roadmap")) return "Roadmap";
    if (pathname.includes("/gantt")) return "Gantt";
    if (pathname.includes("/productivity")) return "Productivity";
    return null; // Default label
  };

  const pageHeading = getPageLabel(pathname);
  return (
    <header className="flex sticky top-0 z-50 bg-white h-12 shrink-0 items-center border-b">
      <div className="flex flex-1 items-center gap-2 px-3">
        <SidebarTrigger />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block text-[15px]">
              {pageHeading ? (
                <BreadcrumbLink asChild>
                  <Link to={`/workspace/${workspaceId}`}>Dashboard</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage className="line-clamp-1 ">
                  Dashboard
                </BreadcrumbPage>
              )}
            </BreadcrumbItem>

            {pageHeading && (
              <>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem className="text-[15px]">
                  <BreadcrumbPage className="line-clamp-1">
                    {pageHeading}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div className="flex items-center gap-2 px-3">
        <ActiveTimerChip />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-2 text-muted-foreground"
          onClick={openSearch}
        >
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">Search</span>
          <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium sm:inline">
            Ctrl K
          </kbd>
        </Button>
        <Suspense
          fallback={
            searchOpen ? (
              <span className="text-xs text-muted-foreground">Loading...</span>
            ) : null
          }
        >
          {searchChunkRequested && (
            <GlobalSearchCommand
              open={searchOpen}
              onOpenChange={handleSearchOpenChange}
            />
          )}
        </Suspense>
        <NotificationCenter />
      </div>
    </header>
  );
};

export default Header;
