import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Users, 
  Database, 
  Brain, 
  Eye, 
  Activity, 
  TrendingUp,
  Clock,
  CheckCircle
} from "lucide-react";

const stats = [
  {
    title: "Total Users",
    value: "247",
    change: "+12%",
    icon: Users,
    color: "text-blue-500"
  },
  {
    title: "Face Images",
    value: "3,892",
    change: "+8%",
    icon: Database,
    color: "text-green-500"
  },
  {
    title: "Model Accuracy",
    value: "97.8%",
    change: "+0.3%",
    icon: Brain,
    color: "text-purple-500"
  },
  {
    title: "Recognitions Today",
    value: "1,456",
    change: "+23%",
    icon: Eye,
    color: "text-cyan-500"
  }
];

const recentActivity = [
  { user: "John Doe", action: "Face recognized", time: "2 min ago", status: "success" },
  { user: "Jane Smith", action: "New face added", time: "5 min ago", status: "info" },
  { user: "Mike Johnson", action: "Recognition failed", time: "8 min ago", status: "warning" },
  { user: "Sarah Wilson", action: "Face recognized", time: "12 min ago", status: "success" },
];

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-gradient-hero">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Monitor your face recognition system performance and activity
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title} className="bg-gradient-card shadow-card border-border/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <Icon className={cn("h-4 w-4", stat.color)} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                  <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                    <TrendingUp className="h-3 w-3 text-green-500" />
                    <span>{stat.change} from last month</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Model Training Status */}
          <Card className="bg-gradient-card shadow-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-foreground">
                <Brain className="h-5 w-5 text-primary" />
                <span>Model Training Status</span>
              </CardTitle>
              <CardDescription>Current training progress and metrics</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Training Progress</span>
                  <span className="text-foreground font-medium">78%</span>
                </div>
                <Progress value={78} className="h-2" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Epochs</p>
                  <p className="text-lg font-semibold text-foreground">156/200</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Loss</p>
                  <p className="text-lg font-semibold text-foreground">0.023</p>
                </div>
              </div>
              
              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                <Activity className="h-3 w-3 mr-1" />
                Training in progress
              </Badge>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="bg-gradient-card shadow-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-foreground">
                <Clock className="h-5 w-5 text-primary" />
                <span>Recent Activity</span>
              </CardTitle>
              <CardDescription>Latest face recognition events</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        activity.status === "success" && "bg-green-500",
                        activity.status === "info" && "bg-blue-500",
                        activity.status === "warning" && "bg-yellow-500"
                      )} />
                      <div>
                        <p className="text-sm font-medium text-foreground">{activity.user}</p>
                        <p className="text-xs text-muted-foreground">{activity.action}</p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">{activity.time}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}