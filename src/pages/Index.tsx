import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { GraduationCap, Brain, Database, UserCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-4">Face Recognition Attendance System</h1>
          <p className="text-xl text-muted-foreground mb-8">
            Intelligent attendance marking powered by AI face recognition
          </p>
          <div className="flex gap-4 justify-center">
            <Button 
              size="lg" 
              onClick={() => navigate('/auth')}
              className="text-lg px-8"
            >
              Sign In
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => navigate('/auth')}
              className="text-lg px-8"
            >
              Sign Up
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          <div className="p-6 rounded-lg bg-card border text-center">
            <Database className="h-12 w-12 mx-auto mb-4 text-primary" />
            <h3 className="text-lg font-semibold mb-2">Dataset Management</h3>
            <p className="text-sm text-muted-foreground">
              Organize and manage student face data efficiently
            </p>
          </div>
          
          <div className="p-6 rounded-lg bg-card border text-center">
            <Brain className="h-12 w-12 mx-auto mb-4 text-primary" />
            <h3 className="text-lg font-semibold mb-2">AI Training</h3>
            <p className="text-sm text-muted-foreground">
              Train models with high accuracy recognition
            </p>
          </div>
          
          <div className="p-6 rounded-lg bg-card border text-center">
            <GraduationCap className="h-12 w-12 mx-auto mb-4 text-primary" />
            <h3 className="text-lg font-semibold mb-2">Face Recognition</h3>
            <p className="text-sm text-muted-foreground">
              Identify students instantly with advanced AI
            </p>
          </div>
          
          <div className="p-6 rounded-lg bg-card border text-center">
            <UserCheck className="h-12 w-12 mx-auto mb-4 text-primary" />
            <h3 className="text-lg font-semibold mb-2">Attendance Tracking</h3>
            <p className="text-sm text-muted-foreground">
              Automated attendance with camera capture
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
