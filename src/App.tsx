import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Heart } from 'lucide-react';
import Login from './pages/Login';
import Assessment from './pages/Assessment';
import DetailedAssessment from './pages/DetailedAssessment';
import Header from './components/Header';
import Footer from './components/Footer';
import Dashboard from './pages/Dashboard';
import HealthTracking from './pages/HealthTracking';
import MentalHealth from './pages/MentalHealth';
import Education from './pages/Education';
import Community from './pages/Community';
import Emergency from './pages/Emergency';
import Profile from './pages/Profile';
import { authAPI, mentalHealthAPI, getAccessToken } from './services/api';

function App() {
  const [user, setUser] = React.useState<any>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [showQuestionnaire, setShowQuestionnaire] = React.useState(false);
  const [isNewUser, setIsNewUser] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const token = getAccessToken();
        if (!token) {
          if (mounted) {
            setIsLoading(false);
          }
          return;
        }

        // Verify token and get user
        const response = await authAPI.getCurrentUser();
        if (mounted && response.success && response.data.user) {
          await fetchUserProfile(response.data.user.id);
        } else {
          if (mounted) {
            setIsLoading(false);
          }
        }
      } catch (err) {
        console.error('Auth init error:', err);
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initAuth();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      // Get current user data
      const userResponse = await authAPI.getCurrentUser();
      if (!userResponse.success || !userResponse.data.user) {
        setIsLoading(false);
        return;
      }

      const authUser = userResponse.data.user;

      // Check if user has completed any assessment (not forcing, just tracking)
      let hasCompletedAssessment = false;
      try {
        const assessmentResponse = await mentalHealthAPI.getAssessments({ 
          limit: 1 
        });
        hasCompletedAssessment = assessmentResponse.success && 
          assessmentResponse.data?.assessments?.length > 0;
      } catch (err) {
        console.error('Failed to check assessment:', err);
      }

      setUser({
        id: userId,
        email: authUser.email,
        name: authUser.fullName || 'User',
        hasCompletedAssessment,
      });

      // Only show assessment for brand new users (first time login after registration)
      // Existing users can access assessment anytime via Dashboard or Mental Health page
      // Don't force assessment on every login - mental conditions can change, users can retake when needed

      setIsLoading(false);
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
      setIsLoading(false);
    }
  };

  const handleLogin = async (userData: any, isNew: boolean = false) => {
    // If not a new user, check assessment status
    if (!isNew && userData.id) {
      try {
        const assessmentResponse = await mentalHealthAPI.getAssessments({ 
          type: 'custom', 
          limit: 1 
        });
        const hasCompletedAssessment = assessmentResponse.success && 
          assessmentResponse.data?.assessments?.length > 0;
        userData.hasCompletedAssessment = hasCompletedAssessment;

        if (!hasCompletedAssessment) {
          setIsNewUser(false);
          setShowQuestionnaire(true);
        }
      } catch (err) {
        console.error('Failed to check assessment:', err);
        // Assume no assessment if check fails
        userData.hasCompletedAssessment = false;
        if (!isNew) {
          setIsNewUser(false);
          setShowQuestionnaire(true);
        }
      }
    }

    setUser(userData);
    if (isNew) {
      setIsNewUser(true);
      setShowQuestionnaire(true);
    }
  };

  const handleLogout = async () => {
    await authAPI.logout();
    setUser(null);
  };

  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (isLoading) {
        console.warn('Auth loading timeout - forcing UI display');
        setIsLoading(false);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [isLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-gradient-to-r from-rose-400 to-pink-400 p-4 rounded-xl mb-4 inline-block">
            <Heart className="h-8 w-8 text-white animate-pulse" />
          </div>
          <p className="text-gray-600">Loading your wellness companion...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-rose-500 hover:bg-rose-600 text-white px-6 py-2 rounded-lg"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  if (showQuestionnaire && (isNewUser || !user.hasCompletedAssessment)) {
    return (
      <DetailedAssessment
        userName={user.name}
        userId={user.id}
        onComplete={() => {
          setShowQuestionnaire(false);
          setIsNewUser(false);
          // Update user state to mark assessment as completed
          setUser({ ...user, hasCompletedAssessment: true });
        }}
      />
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50">
        <Header user={user} onLogout={handleLogout} />
        <main className="pt-16">
          <Routes>
            <Route path="/" element={<Dashboard user={user} />} />
            <Route path="/health-tracking" element={<HealthTracking />} />
            <Route path="/mental-health" element={<MentalHealth />} />
            <Route path="/assessment" element={<Assessment userName={user.name} userId={user.id} onComplete={() => window.history.back()} />} />
            <Route path="/detailed-assessment" element={<DetailedAssessment userName={user.name} userId={user.id} onComplete={() => window.history.back()} />} />
            <Route path="/education" element={<Education />} />
            <Route path="/community" element={<Community />} />
            <Route path="/emergency" element={<Emergency />} />
            <Route path="/profile" element={<Profile user={user} />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;