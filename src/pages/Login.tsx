import React, { useState } from 'react';
import { Heart, Eye, EyeOff, Mail, Lock, User, Phone } from 'lucide-react';
import { authAPI, mentalHealthAPI } from '../services/api';

interface LoginProps {
  onLogin: (user: any) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
    confirmPassword: '',
    rememberMe: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        // Password validation
        if (formData.password !== formData.confirmPassword) {
          throw new Error('Passwords do not match');
        }

        if (formData.password.length < 8) {
          throw new Error('Password must be at least 8 characters long');
        }

        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
          throw new Error('Password must contain at least one uppercase letter, one lowercase letter, and one number');
        }

        // Name validation
        if (formData.name.length < 2 || formData.name.length > 100) {
          throw new Error('Name must be between 2 and 100 characters');
        }

        // Phone validation (if provided)
        if (formData.phone && !/^\+?[\d\s\-()]+$/.test(formData.phone)) {
          throw new Error('Please enter a valid phone number');
        }

        const response = await authAPI.register({
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          fullName: formData.name,
          phone: formData.phone || undefined,
        });

        if (!response.success) {
          throw new Error(response.message || 'Registration failed');
        }

        const userData = response.data.user;
        if (!userData) throw new Error('Failed to create account');

        // Check assessment status
        try {
          const assessmentResponse = await mentalHealthAPI.getAssessments({ type: 'custom', limit: 1 });
          const hasCompletedAssessment = assessmentResponse.success && 
            assessmentResponse.data?.assessments?.length > 0;
          
          onLogin({
            id: userData.id,
            email: userData.email,
            name: userData.fullName,
            hasCompletedAssessment: !!hasCompletedAssessment,
          }, true);
        } catch (err) {
          // If assessment check fails, continue with login
          onLogin({
            id: userData.id,
            email: userData.email,
            name: userData.fullName,
            hasCompletedAssessment: false,
          }, true);
        }
      } else {
        // Email validation for login
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
          throw new Error('Please enter a valid email address');
        }

        if (!formData.password) {
          throw new Error('Password is required');
        }

        const response = await authAPI.login(
          formData.email.trim().toLowerCase(),
          formData.password
        );

        if (!response.success) {
          if (response.message.includes('Invalid credentials')) {
            throw new Error('Invalid email or password. Please check your credentials and try again.');
          } else if (response.message.includes('deactivated')) {
            throw new Error('Your account has been deactivated. Please contact support.');
          }
          throw new Error(response.message || 'Login failed');
        }

        const userData = response.data.user;
        if (!userData) throw new Error('Failed to sign in');

        // Fetch assessment status
        let hasCompletedAssessment = false;
        try {
          const assessmentResponse = await mentalHealthAPI.getAssessments({ type: 'custom', limit: 1 });
          hasCompletedAssessment = assessmentResponse.success && 
            assessmentResponse.data?.assessments?.length > 0;
        } catch (err) {
          // Continue if assessment check fails
          console.error('Failed to check assessment status:', err);
        }

        onLogin({
          id: userData.id,
          email: userData.email,
          name: userData.fullName || 'User',
          hasCompletedAssessment,
        });
      }
    } catch (err: any) {
      let errorMessage = err.message || 'An error occurred';

      // Network errors
      if (errorMessage.includes('Network error') || 
          errorMessage.includes('Cannot connect to server') ||
          errorMessage.includes('Failed to fetch')) {
        errorMessage = 'Cannot connect to server. Please ensure the backend server is running on http://localhost:5000';
      }
      // Registration errors
      else if (errorMessage.includes('User already registered') || errorMessage.includes('already exists')) {
        errorMessage = 'This email is already registered. Please sign in instead.';
      } else if (errorMessage.includes('Password')) {
        // Keep the specific password error message
      } else if (errorMessage.includes('Name')) {
        // Keep the specific name error message
      } else if (errorMessage.includes('phone')) {
        // Keep the specific phone error message
      } 
      // Login errors (already handled above, but keep for fallback)
      else if (errorMessage.includes('Invalid login credentials') || errorMessage.includes('Invalid email or password')) {
        // Already handled with better message
      } else if (errorMessage.includes('Network') || errorMessage.includes('fetch')) {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else if (errorMessage.includes('timeout')) {
        errorMessage = 'Request timed out. Please try again.';
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
    // Clear error when user starts typing
    if (error) setError('');
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        throw new Error('Please enter a valid email address');
      }

      // TODO: Implement password reset in backend
      throw new Error('Password reset is not yet available. Please contact support.');

      setResetEmailSent(true);
      setTimeout(() => {
        setShowForgotPassword(false);
        setResetEmailSent(false);
      }, 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to send password reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMode = () => {
    setIsSignUp(!isSignUp);
    setError('');
    setShowForgotPassword(false);
    setResetEmailSent(false);
    // Reset form when switching modes
    setFormData({
      email: '',
      password: '',
      name: '',
      phone: '',
      confirmPassword: '',
      rememberMe: false,
    });
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Background Image */}
      <div 
        className="hidden lg:flex lg:w-1/2 relative bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.3)), url('https://images.pexels.com/photos/1257110/pexels-photo-1257110.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2')`
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-rose-500/20 to-pink-500/20"></div>
        <div className="relative z-10 flex flex-col justify-center items-start p-12 text-white">
          <div className="max-w-md">
            <div className="flex items-center space-x-3 mb-8">
              <div className="bg-white/20 backdrop-blur-sm p-3 rounded-xl">
                <Heart className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Whispers of Motherhood</h1>
                <p className="text-rose-100">Your postpartum wellness companion</p>
              </div>
            </div>
            
            <h2 className="text-4xl font-bold mb-6 leading-tight">
              Supporting You Through Your Motherhood Journey
            </h2>
            
            <p className="text-lg text-rose-100 mb-8 leading-relaxed">
              Join thousands of mothers who trust our comprehensive platform for postpartum health monitoring, 
              mental wellness support, and community connection.
            </p>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-white rounded-full"></div>
                <span className="text-rose-100">24/7 Health Monitoring & Support</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-white rounded-full"></div>
                <span className="text-rose-100">Expert-Curated Educational Resources</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-white rounded-full"></div>
                <span className="text-rose-100">Caring Community of Mothers</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-white rounded-full"></div>
                <span className="text-rose-100">Emergency Resources & Crisis Support</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50">
        <div className="w-full max-w-md">
          {/* Mobile header */}
          <div className="lg:hidden text-center mb-8">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <div className="bg-gradient-to-r from-rose-400 to-pink-400 p-3 rounded-xl">
                <Heart className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-rose-600 to-pink-600 bg-clip-text text-transparent">
                  Whispers of Motherhood
                </h1>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                {isSignUp ? 'Join Our Community' : 'Welcome Back'}
              </h2>
              <p className="text-gray-600">
                {isSignUp 
                  ? 'Create your account to start your wellness journey' 
                  : 'Sign in to continue your wellness journey'
                }
              </p>
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
                <p className="text-sm text-red-800 font-medium">{error}</p>
              </div>
            )}

            {resetEmailSent && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg mb-4">
                <p className="text-sm text-green-800 font-medium">
                  Password reset email sent! Please check your inbox and follow the instructions to reset your password.
                </p>
              </div>
            )}

            {showForgotPassword ? (
              <form onSubmit={handleForgotPassword} className="space-y-6">
                <div>
                  <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      id="reset-email"
                      name="email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-colors"
                      placeholder="Enter your email"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setError('');
                    }}
                    className="text-sm text-gray-600 hover:text-gray-900 font-medium"
                  >
                    ← Back to Sign In
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white py-3 px-4 rounded-lg transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>
            ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {isSignUp && (
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      id="name"
                      name="name"
                      type="text"
                      required={isSignUp}
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-colors"
                      placeholder="Enter your full name"
                    />
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={handleInputChange}
                      autoComplete="email"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-colors"
                      placeholder="Enter your email"
                    />
                </div>
              </div>

              {isSignUp && (
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-colors"
                      placeholder="Enter your phone number"
                    />
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={formData.password}
                      onChange={handleInputChange}
                      autoComplete={isSignUp ? 'new-password' : 'current-password'}
                      className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-colors"
                      placeholder="Enter your password"
                    />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {isSignUp && (
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      required={isSignUp}
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-colors"
                      placeholder="Confirm your password"
                    />
                  </div>
                </div>
              )}

              {!isSignUp && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input
                      id="remember-me"
                      name="rememberMe"
                      type="checkbox"
                      checked={formData.rememberMe}
                      onChange={handleInputChange}
                      className="h-4 w-4 text-rose-600 focus:ring-rose-500 border-gray-300 rounded cursor-pointer"
                    />
                    <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700 cursor-pointer">
                      Remember me
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(true);
                      setError('');
                    }}
                    className="text-sm text-rose-600 hover:text-rose-500 font-medium transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white py-3 px-4 rounded-lg transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {isSignUp ? 'Creating Account...' : 'Signing In...'}
                  </span>
                ) : (
                  isSignUp ? 'Create Account' : 'Sign In'
                )}
              </button>
            </form>
            )}

            {isSignUp && (
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Privacy Notice:</strong> Your health data is encrypted and secure. 
                  We never share personal information without your explicit consent.
                </p>
              </div>
            )}

            <div className="mt-8 text-center">
              <p className="text-gray-600">
                {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                <button
                  type="button"
                  onClick={handleToggleMode}
                  className="ml-2 text-rose-600 hover:text-rose-500 font-medium transition-colors"
                >
                  {isSignUp ? 'Sign in' : 'Sign up'}
                </button>
              </p>
            </div>

            <div className="mt-6 text-center">
              <p className="text-xs text-gray-500">
                By continuing, you agree to our Terms of Service and Privacy Policy
              </p>
            </div>
          </div>

          {/* Emergency Notice */}
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <Heart className="h-5 w-5 text-red-600" />
              <p className="text-sm text-red-800">
                <strong>Emergency:</strong> If you're experiencing thoughts of self-harm, 
                call 14416 (Tele-MANAS) or 112 immediately.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;