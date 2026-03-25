import React from 'react';
import { Heart, Phone, Mail, MapPin } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-gradient-to-r from-rose-900 to-pink-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-white/20 p-2 rounded-lg">
                <Heart className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold">Whispers of Motherhood</h3>
                <p className="text-rose-200 text-sm">Your postpartum wellness companion</p>
              </div>
            </div>
            <p className="text-rose-100 mb-4 max-w-md">
              Supporting mothers through their postpartum journey with comprehensive health monitoring, 
              mental health support, and a caring community.
            </p>
            <div className="text-sm text-rose-200">
              <p className="mb-1">🌸 Available 24/7 for your support</p>
              <p>💝 Trusted by thousands of mothers worldwide</p>
            </div>
          </div>

          <div>
            <h4 className="text-lg font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2 text-rose-100">
              <li><a href="/" className="hover:text-white transition-colors">Dashboard</a></li>
              <li><a href="/health-tracking" className="hover:text-white transition-colors">Health Tracking</a></li>
              <li><a href="/mental-health" className="hover:text-white transition-colors">Mental Health</a></li>
              <li><a href="/education" className="hover:text-white transition-colors">Education</a></li>
              <li><a href="/community" className="hover:text-white transition-colors">Community</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-lg font-semibold mb-4">Emergency Contact</h4>
            <div className="space-y-3 text-rose-100">
              <div className="flex items-center space-x-2">
                <Phone className="h-4 w-4" />
                <span className="text-sm">Crisis Helpline (India): 14416</span>
              </div>
              <div className="flex items-center space-x-2">
                <Mail className="h-4 w-4" />
                <span className="text-sm">support@whispers.health</span>
              </div>
              <div className="flex items-center space-x-2">
                <MapPin className="h-4 w-4" />
                <span className="text-sm">24/7 Support Available</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-rose-800 mt-8 pt-8 text-center">
          <p className="text-rose-200 text-sm">
            © 2025 Whispers of Motherhood. Made with 💝 for mothers everywhere.
          </p>
          <p className="text-rose-300 text-xs mt-2">
            Always consult with healthcare professionals for medical advice.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;