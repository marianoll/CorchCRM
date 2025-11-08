import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Mail } from "lucide-react";

export default function SettingsPage() {
  return (
    <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
            <h1 className="text-3xl font-bold tracking-tight font-headline">Settings</h1>
            <p className="text-muted-foreground">Manage your integrations and application settings.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Integrations</CardTitle>
            <CardDescription>Connect your accounts to enable automated data flow.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                    <Mail className="w-6 h-6 text-primary" />
                    <div>
                        <p className="font-semibold">Gmail</p>
                        <p className="text-sm text-muted-foreground">Connected as admin@autoflow.com</p>
                    </div>
                </div>
                <Button variant="outline">Disconnect</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
            <CardDescription>Customize the application to your liking.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="language-select">Language</Label>
              <Select defaultValue="es">
                <SelectTrigger id="language-select" className="w-[180px]">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="es">Español</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Privacy</CardTitle>
                <CardDescription>Manage how your data is used to improve our AI models.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <Label htmlFor="data-sharing">Contribute to model training</Label>
                        <p className="text-sm text-muted-foreground">Allow anonymized data to be used to improve AI accuracy.</p>
                    </div>
                    <Switch id="data-sharing" defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                    <div>
                        <Label htmlFor="personalization">Personalized suggestions</Label>
                        <p className="text-sm text-muted-foreground">Let AI learn from your actions to provide better suggestions.</p>
                    </div>
                    <Switch id="personalization" defaultChecked />
                </div>
            </CardContent>
        </Card>

      </div>
    </main>
  );
}
