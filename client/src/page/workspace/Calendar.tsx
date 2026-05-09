import CalendarView from "@/components/workspace/task/calendar-view";

export default function Calendar() {
  return (
    <div className="w-full h-full flex-col space-y-8 pt-3">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Calendar</h2>
          <p className="text-muted-foreground">
            View and track all your project tasks on a calendar
          </p>
        </div>
      </div>
      <CalendarView />
    </div>
  );
}
