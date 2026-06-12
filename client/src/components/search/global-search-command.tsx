import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  Folder,
  Loader,
  MessageSquare,
  UserRound,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import useWorkspaceId from "@/hooks/use-workspace-id";
import {
  searchWorkspacePreviewQueryFn,
  searchWorkspaceTypeQueryFn,
} from "@/lib/api";
import {
  SearchGroupType,
  SearchResultItemType,
  SearchResultTypeEnumType,
} from "@/types/api.type";

const RECENT_SEARCHES_KEY = "teamsync:recent-searches";
const MAX_RECENT_SEARCHES = 8;

const typeLabel: Record<SearchResultTypeEnumType, string> = {
  PROJECT: "Projects",
  TASK: "Tasks",
  COMMENT: "Comments",
  MEMBER: "Members",
};

const typeIcon = {
  PROJECT: Folder,
  TASK: FileText,
  COMMENT: MessageSquare,
  MEMBER: UserRound,
};

const readRecentSearches = (): SearchResultItemType[] => {
  try {
    const stored = window.localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT_SEARCHES) : [];
  } catch {
    return [];
  }
};

const writeRecentSearches = (results: SearchResultItemType[]) => {
  window.localStorage.setItem(
    RECENT_SEARCHES_KEY,
    JSON.stringify(results.slice(0, MAX_RECENT_SEARCHES))
  );
};

function SearchResultRow({
  result,
  onSelect,
}: {
  result: SearchResultItemType;
  onSelect: (result: SearchResultItemType) => void;
}) {
  const Icon = typeIcon[result.type];

  return (
    <CommandItem
      value={`${result.type} ${result.title} ${result.subtitle} ${result.snippet}`}
      onSelect={() => onSelect(result)}
      className="cursor-pointer items-start gap-3 py-3"
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{result.title}</span>
          <Badge variant="secondary" className="shrink-0 text-[10px]">
            {result.type.toLowerCase()}
          </Badge>
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {result.subtitle}
        </span>
        {result.snippet && (
          <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">
            {result.snippet}
          </span>
        )}
      </span>
    </CommandItem>
  );
}

export default function GlobalSearchCommand({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const workspaceId = useWorkspaceId();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedType, setSelectedType] =
    useState<SearchResultTypeEnumType | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [recentSearches, setRecentSearches] = useState<SearchResultItemType[]>(
    []
  );

  useEffect(() => {
    setRecentSearches(readRecentSearches());
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPageNumber(1);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!open) {
      setSelectedType(null);
      setPageNumber(1);
    }
  }, [open]);

  const canSearch = open && debouncedQuery.length >= 2;

  const previewQuery = useQuery({
    queryKey: ["global-search-preview", workspaceId, debouncedQuery],
    queryFn: () =>
      searchWorkspacePreviewQueryFn({
        workspaceId,
        q: debouncedQuery,
        limitPerType: 5,
      }),
    enabled: canSearch && !selectedType,
  });

  const typeQuery = useQuery({
    queryKey: [
      "global-search-type",
      workspaceId,
      selectedType,
      debouncedQuery,
      pageNumber,
    ],
    queryFn: () =>
      searchWorkspaceTypeQueryFn({
        workspaceId,
        type: selectedType as SearchResultTypeEnumType,
        q: debouncedQuery,
        pageNumber,
        pageSize: 20,
      }),
    enabled: canSearch && !!selectedType,
  });

  const groups = useMemo<SearchGroupType[]>(
    () => previewQuery.data?.groups || [],
    [previewQuery.data?.groups]
  );
  const hasPreviewResults = groups.some((group) => group.results.length > 0);
  const typeResults = typeQuery.data?.results || [];
  const typePagination = typeQuery.data?.pagination;

  const persistRecent = (result: SearchResultItemType) => {
    const next = [
      result,
      ...recentSearches.filter((recent) => recent.id !== result.id),
    ].slice(0, MAX_RECENT_SEARCHES);
    setRecentSearches(next);
    writeRecentSearches(next);
  };

  const handleSelect = (result: SearchResultItemType) => {
    persistRecent(result);
    onOpenChange(false);
    setQuery("");
    setDebouncedQuery("");
    navigate(result.url);
  };

  const isLoading = previewQuery.isFetching || typeQuery.isFetching;

  return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="top-[12vh] max-h-[78vh] translate-y-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Global workspace search</DialogTitle>
          </DialogHeader>
          <Command shouldFilter={false}>
            <CommandInput
              value={query}
              onValueChange={(value) => {
                setQuery(value);
                setSelectedType(null);
              }}
              placeholder="Search projects, tasks, comments, and members..."
            />
            <CommandList className="max-h-[62vh]">
              {isLoading && (
                <div className="flex items-center justify-center py-6">
                  <Loader className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}

              {!isLoading && debouncedQuery.length < 2 && (
                <>
                  <CommandGroup heading="Recent searches">
                    {recentSearches.length === 0 ? (
                      <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                        No recent searches
                      </div>
                    ) : (
                      recentSearches.map((result) => (
                        <SearchResultRow
                          key={result.id}
                          result={result}
                          onSelect={handleSelect}
                        />
                      ))
                    )}
                  </CommandGroup>
                </>
              )}

              {!isLoading &&
                debouncedQuery.length >= 2 &&
                !selectedType &&
                !hasPreviewResults && (
                  <CommandEmpty>No results found.</CommandEmpty>
                )}

              {!isLoading &&
                debouncedQuery.length >= 2 &&
                !selectedType &&
                groups.map((group) =>
                  group.results.length > 0 ? (
                    <CommandGroup
                      key={group.type}
                      heading={`${typeLabel[group.type]} (${group.totalCount})`}
                    >
                      {group.results.map((result) => (
                        <SearchResultRow
                          key={result.id}
                          result={result}
                          onSelect={handleSelect}
                        />
                      ))}
                      {group.totalCount > group.results.length && (
                        <>
                          <CommandSeparator />
                          <CommandItem
                            value={`show more ${group.type}`}
                            onSelect={() => {
                              setSelectedType(group.type);
                              setPageNumber(1);
                            }}
                            className="cursor-pointer justify-center text-sm text-muted-foreground"
                          >
                            Show more {typeLabel[group.type].toLowerCase()}
                          </CommandItem>
                        </>
                      )}
                    </CommandGroup>
                  ) : null
                )}

              {!isLoading && selectedType && (
                <CommandGroup
                  heading={`${typeLabel[selectedType]}${
                    typePagination ? ` (${typePagination.totalCount})` : ""
                  }`}
                >
                  <CommandItem
                    value="back to grouped results"
                    onSelect={() => setSelectedType(null)}
                    className="cursor-pointer text-muted-foreground"
                  >
                    Back to grouped results
                  </CommandItem>
                  <CommandSeparator />
                  {typeResults.length === 0 ? (
                    <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                      No results found.
                    </div>
                  ) : (
                    typeResults.map((result) => (
                      <SearchResultRow
                        key={result.id}
                        result={result}
                        onSelect={handleSelect}
                      />
                    ))
                  )}
                  {typePagination && typePagination.totalPages > 1 && (
                    <div className="flex items-center justify-between px-2 py-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pageNumber <= 1}
                        onClick={() =>
                          setPageNumber((current) => Math.max(1, current - 1))
                        }
                      >
                        Previous
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Page {typePagination.pageNumber} of{" "}
                        {typePagination.totalPages}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pageNumber >= typePagination.totalPages}
                        onClick={() => setPageNumber((current) => current + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
  );
}
