import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

interface TrainingJob {
  id: string;
  job_type: string;
  status: string;
  accuracy: number | null;
  users_processed: number | null;
  embeddings_count: number | null;
  started_at: string;
  completed_at: string | null;
}

interface TrainingHistoryChartProps {
  trainingJobs: TrainingJob[];
}

export function TrainingHistoryChart({ trainingJobs }: TrainingHistoryChartProps) {
  // Prepare data for accuracy trend
  const accuracyData = trainingJobs
    .filter(job => job.status === 'completed' && job.accuracy !== null)
    .map(job => ({
      date: format(new Date(job.completed_at!), 'MMM dd'),
      accuracy: (job.accuracy! * 100).toFixed(2),
      type: job.job_type,
    }))
    .reverse()
    .slice(-10); // Last 10 completed jobs

  // Prepare data for processing stats
  const processingData = trainingJobs
    .filter(job => job.status === 'completed')
    .map(job => ({
      date: format(new Date(job.completed_at!), 'MMM dd'),
      users: job.users_processed || 0,
      embeddings: job.embeddings_count || 0,
    }))
    .reverse()
    .slice(-10);

  return (
    <div className="space-y-6">
      {/* Accuracy Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Model Accuracy Trend
          </CardTitle>
          <CardDescription>
            Accuracy improvements over recent training runs
          </CardDescription>
        </CardHeader>
        <CardContent>
          {accuracyData.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              No completed training jobs yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={accuracyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="accuracy"
                  stroke="#8884d8"
                  strokeWidth={2}
                  name="Accuracy %"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Processing Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Processing Statistics</CardTitle>
          <CardDescription>
            Users and embeddings processed per training run
          </CardDescription>
        </CardHeader>
        <CardContent>
          {processingData.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              No processing data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={processingData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="users" fill="#00C49F" name="Users Processed" />
                <Bar dataKey="embeddings" fill="#8884d8" name="Embeddings" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}