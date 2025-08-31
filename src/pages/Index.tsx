import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { 
  Scan, 
  Database, 
  Brain, 
  Eye, 
  Shield, 
  Zap,
  ArrowRight,
  CheckCircle
} from "lucide-react";
import heroImage from "@/assets/hero-bg.jpg";

const features = [
  {
    title: "Face Dataset Collection",
    description: "Capture and organize face images with automated dataset management",
    icon: Database,
    color: "text-blue-500"
  },
  {
    title: "AI-Powered Detection",
    description: "Advanced face detection using OpenCV and deep learning models",
    icon: Eye,
    color: "text-green-500"
  },
  {
    title: "Model Training",
    description: "Train custom recognition models with high accuracy rates",
    icon: Brain,
    color: "text-purple-500"
  },
  {
    title: "Real-time Recognition",
    description: "Instant face recognition in images and video streams",
    icon: Zap,
    color: "text-yellow-500"
  }
];

const benefits = [
  "99% accuracy rate with optimized deep learning models",
  "Real-time processing for live video streams",
  "Scalable architecture supporting thousands of users",
  "Enterprise-grade security and privacy protection",
  "Easy integration with existing systems"
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div 
          className="absolute inset-0 bg-gradient-hero"
          style={{
            backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.8), rgba(15, 23, 42, 0.6)), url(${heroImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <Badge className="mb-6 bg-primary/10 text-primary border-primary/20 px-4 py-2">
            <Scan className="h-4 w-4 mr-2" />
            Advanced Face Recognition System
          </Badge>
          
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 leading-tight">
            Intelligent Face
            <span className="bg-gradient-primary bg-clip-text text-transparent"> Recognition</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed">
            Deploy enterprise-grade face recognition with AI-powered detection, 
            real-time processing, and unmatched accuracy for security and access control.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button 
              asChild 
              size="lg" 
              className="bg-gradient-primary hover:shadow-glow transition-all duration-300 px-8 py-4 text-lg"
            >
              <Link to="/dashboard" className="flex items-center">
                Get Started
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            
            <Button 
              variant="outline" 
              size="lg" 
              className="border-primary/20 text-primary hover:bg-primary/10 px-8 py-4 text-lg"
            >
              View Demo
            </Button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">99.8%</div>
              <div className="text-sm text-muted-foreground">Accuracy</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">&lt; 100ms</div>
              <div className="text-sm text-muted-foreground">Response Time</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">10K+</div>
              <div className="text-sm text-muted-foreground">Faces Processed</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">24/7</div>
              <div className="text-sm text-muted-foreground">Monitoring</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gradient-hero">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Powerful Recognition Features
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Complete face recognition pipeline from data collection to real-time identification
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card key={index} className="bg-gradient-card shadow-card border-border/50 hover:shadow-glow transition-all duration-300">
                  <CardHeader>
                    <Icon className={`h-8 w-8 ${feature.color} mb-2`} />
                    <CardTitle className="text-foreground">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-muted-foreground">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">
                <Shield className="h-4 w-4 mr-2" />
                Enterprise Ready
              </Badge>
              
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                Why Choose Our Face Recognition System?
              </h2>
              
              <div className="space-y-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">{benefit}</span>
                  </div>
                ))}
              </div>
              
              <Button 
                asChild 
                className="mt-8 bg-gradient-primary hover:shadow-glow transition-all duration-300"
                size="lg"
              >
                <Link to="/dashboard">
                  Start Building
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
            
            <div className="relative">
              <Card className="bg-gradient-card shadow-card border-border/50 p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">System Status</span>
                    <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Online</Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Recognition Accuracy</span>
                      <span className="text-foreground">99.8%</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full w-[99.8%] bg-gradient-primary rounded-full" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary">1,247</div>
                      <div className="text-xs text-muted-foreground">Users Registered</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary">24/7</div>
                      <div className="text-xs text-muted-foreground">Active Monitoring</div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-hero">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
            Ready to Deploy Advanced Face Recognition?
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Get started with our comprehensive face recognition system today
          </p>
          <Button 
            asChild 
            size="lg" 
            className="bg-gradient-primary hover:shadow-glow transition-all duration-300 px-8 py-4 text-lg"
          >
            <Link to="/dashboard">
              Launch Dashboard
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
};

export default Index;
