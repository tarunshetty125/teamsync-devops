import { lazy, Suspense, useState } from "react";
import CreateTaskDialog from "@/components/workspace/task/create-task-dialog";
import TaskTable from "@/components/workspace/task/task-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const KanbanBoard = lazy(
  () => import("@/components/workspace/task/board/kanban-board")
);

export default function Tasks() {
  const [view, setView] = useState("list");

  return (
    <div className="w-full h-full flex-col space-y-8 pt-3">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">All Tasks</h2>
          <p className="text-muted-foreground">
            Here&apos;s the list of tasks for this workspace!
          </p>
        </div>
        <CreateTaskDialog />
      </div>
      <Tabs value={view} onValueChange={setView} className="space-y-4">
        <TabsList>
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="board">Board</TabsTrigger>
        </TabsList>
        <TabsContent value="list">
          <TaskTable />
        </TabsContent>
        <TabsContent value="board">
          {view === "board" && (
            <Suspense
              fallback={
                <div className="h-[520px] rounded-md border bg-muted/30" />
              }
            >
              <KanbanBoard />
            </Suspense>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
