import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { GraduationCap, Brain, Database, UserCheck, ArrowRight } from "lucide-react";
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

  const features = [
    {
      icon: Database,
      title: "Dataset Management",
      description: "Organize and manage student face data efficiently"
    },
    {
      icon: Brain,
      title: "AI Training",
      description: "Train models with high accuracy recognition"
    },
    {
      icon: GraduationCap,
      title: "Face Recognition",
      description: "Identify students instantly with advanced AI"
    },
    {
      icon: UserCheck,
      title: "Attendance Tracking",
      description: "Automated attendance with camera capture"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero" />
        <div className="absolute inset-0 bg-dots opacity-50" />
        
        <div className="container relative mx-auto px-4 py-24 lg:py-32">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-foreground mb-6">
              Face Recognition
              <span className="block text-primary">Attendance System</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto leading-relaxed">
              Intelligent attendance marking powered by AI face recognition. 
              Simple, accurate, and efficient.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button 
                size="lg" 
                onClick={() => navigate('/auth')}
                className="group"
              >
                Get Started
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => navigate('/auth')}
              >
                Sign In
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-semibold text-foreground mb-3">
            Everything you need
          </h2>
          <p className="text-muted-foreground">
            A complete solution for modern attendance management
          </p>
        </div>
        
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {features.map((feature, index) => (
            <div 
              key={index}
              className="group p-6 rounded-lg bg-card border border-border hover:border-primary/20 hover:shadow-card transition-all duration-200"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                <feature.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-medium text-foreground mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Face Recognition Attendance System
        </div>
      </footer>
    </div>
  );
};

export default Index;
