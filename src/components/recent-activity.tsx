import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { recentActivityData } from "@/lib/mock-data";
import { Mail, Mic, Briefcase, User } from "lucide-react";

const iconMap = {
  Mail: <Mail className="h-4 w-4 text-muted-foreground" />,
  Mic: <Mic className="h-4 w-4 text-muted-foreground" />,
  Briefcase: <Briefcase className="h-4 w-4 text-muted-foreground" />,
  User: <User className="h-4 w-4 text-muted-foreground" />,
};

export function RecentActivity() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recentActivityData.map((activity) => (
            <div key={activity.id} className="flex items-start gap-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary">
                {iconMap[activity.icon as keyof typeof iconMap]}
              </div>
              <div className="flex-1">
                <p className="text-sm">{activity.description}</p>
                <p className="text-xs text-muted-foreground">{activity.time}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
