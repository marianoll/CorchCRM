import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { taskData } from "@/lib/mock-data";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";

export function UpcomingTasks() {
  const upcomingTasks = taskData.filter(task => !task.completed).slice(0, 4);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming Tasks</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {upcomingTasks.map((task) => (
            <div key={task.id} className="flex items-start gap-3">
              <Checkbox id={`task-${task.id}`} checked={task.completed} className="mt-1" />
              <div className="flex-1">
                <label htmlFor={`task-${task.id}`} className="text-sm font-medium leading-none">
                  {task.title}
                </label>
                <p className="text-xs text-muted-foreground">
                  Due {format(new Date(task.dueDate), "MMM d, yyyy")}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
