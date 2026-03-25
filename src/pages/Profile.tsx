import React, { useState } from 'react';
import { User, Settings, Bell, Shield, Heart, Calendar, Edit2, Save, X } from 'lucide-react';

interface ProfileProps {
  user: any;
}

interface UserProfile {
  name: string;
  email: string;
  phone: string;
  dueDate: string;
  birthDate: string;
  emergencyContact: {
    name: string;
    phone: string;
    relationship: string;
  };
  healthcareProvider: {
    name: string;
    phone: string;
    address: string;
  };
  preferences: {
    notifications: {
      dailyCheckins: boolean;
      emergencyAlerts: boolean;
      communityUpdates: boolean;
      appointmentReminders: boolean;
    };
    privacy: {
      shareDataWithResearchers: boolean;
      allowCommunityContact: boolean;
      publicProfile: boolean;
    };
  };
}

const Profile: React.FC<ProfileProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState<UserProfile>({
    name: user?.name || 'Sarah Johnson',
    email: user?.email || 'sarah.johnson@email.com',
    phone: '(555) 123-4567',
    dueDate: '2024-12-15',
    birthDate: '2024-12-18',
    emergencyContact: {
      name: 'Michael Johnson',
      phone: '(555) 987-6543',
      relationship: 'Spouse',
    },
    healthcareProvider: {
      name: 'Dr. Emily Rodriguez',
      phone: '(555) 555-0123',
      address: '123 Medical Center Dr, City, ST 12345',
    },
    preferences: {
      notifications: {
        dailyCheckins: true,
        emergencyAlerts: true,
        communityUpdates: true,
        appointmentReminders: true,
      },
      privacy: {
        shareDataWithResearchers: false,
        allowCommunityContact: true,
        publicProfile: false,
      },
    },
  });

  const calculateDaysPostpartum = () => {
    const birthDate = new Date(profile.birthDate);
    const today = new Date();
    const diffTime = today.getTime() - birthDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const handleSave = () => {
    // In a real app, this would save to the backend
    setIsEditing(false);
  };

  const handleCancel = () => {
    // In a real app, this would revert changes
    setIsEditing(false);
  };

  const ProfileTab = () => (
    <div className="space-y-6">
      {/* Personal Information */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Personal Information</h3>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center space-x-2 text-rose-600 hover:text-rose-700 font-medium"
            >
              <Edit2 className="h-4 w-4" />
              <span>Edit</span>
            </button>
          ) : (
            <div className="flex items-center space-x-2">
              <button
                onClick={handleSave}
                className="flex items-center space-x-2 bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-lg transition-colors"
              >
                <Save className="h-4 w-4" />
                <span>Save</span>
              </button>
              <button
                onClick={handleCancel}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-700"
              >
                <X className="h-4 w-4" />
                <span>Cancel</span>
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
            {isEditing ? (
              <input
                type="text"
                value={profile.name}
                onChange={(e) => setProfile({...profile, name: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-colors"
              />
            ) : (
              <p className="text-gray-900">{profile.name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            {isEditing ? (
              <input
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({...profile, email: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-colors"
              />
            ) : (
              <p className="text-gray-900">{profile.email}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
            {isEditing ? (
              <input
                type="tel"
                value={profile.phone}
                onChange={(e) => setProfile({...profile, phone: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-colors"
              />
            ) : (
              <p className="text-gray-900">{profile.phone}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Baby's Birth Date</label>
            {isEditing ? (
              <input
                type="date"
                value={profile.birthDate}
                onChange={(e) => setProfile({...profile, birthDate: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-colors"
              />
            ) : (
              <p className="text-gray-900">{new Date(profile.birthDate).toLocaleDateString()}</p>
            )}
          </div>
        </div>

        {/* Postpartum Status */}
        <div className="mt-6 p-4 bg-rose-50 border border-rose-200 rounded-lg">
          <div className="flex items-center space-x-3">
            <Calendar className="h-5 w-5 text-rose-600" />
            <div>
              <h4 className="font-medium text-rose-900">Postpartum Status</h4>
              <p className="text-rose-700">
                You are {calculateDaysPostpartum()} days postpartum
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Emergency Contact */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Emergency Contact</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
            {isEditing ? (
              <input
                type="text"
                value={profile.emergencyContact.name}
                onChange={(e) => setProfile({
                  ...profile, 
                  emergencyContact: {...profile.emergencyContact, name: e.target.value}
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-colors"
              />
            ) : (
              <p className="text-gray-900">{profile.emergencyContact.name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
            {isEditing ? (
              <input
                type="tel"
                value={profile.emergencyContact.phone}
                onChange={(e) => setProfile({
                  ...profile, 
                  emergencyContact: {...profile.emergencyContact, phone: e.target.value}
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-colors"
              />
            ) : (
              <p className="text-gray-900">{profile.emergencyContact.phone}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Relationship</label>
            {isEditing ? (
              <select
                value={profile.emergencyContact.relationship}
                onChange={(e) => setProfile({
                  ...profile, 
                  emergencyContact: {...profile.emergencyContact, relationship: e.target.value}
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-colors"
              >
                <option>Spouse</option>
                <option>Partner</option>
                <option>Parent</option>
                <option>Sibling</option>
                <option>Friend</option>
                <option>Other</option>
              </select>
            ) : (
              <p className="text-gray-900">{profile.emergencyContact.relationship}</p>
            )}
          </div>
        </div>
      </div>

      {/* Healthcare Provider */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Healthcare Provider</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Provider Name</label>
            {isEditing ? (
              <input
                type="text"
                value={profile.healthcareProvider.name}
                onChange={(e) => setProfile({
                  ...profile, 
                  healthcareProvider: {...profile.healthcareProvider, name: e.target.value}
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-colors"
              />
            ) : (
              <p className="text-gray-900">{profile.healthcareProvider.name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
            {isEditing ? (
              <input
                type="tel"
                value={profile.healthcareProvider.phone}
                onChange={(e) => setProfile({
                  ...profile, 
                  healthcareProvider: {...profile.healthcareProvider, phone: e.target.value}
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-colors"
              />
            ) : (
              <p className="text-gray-900">{profile.healthcareProvider.phone}</p>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
            {isEditing ? (
              <textarea
                rows={2}
                value={profile.healthcareProvider.address}
                onChange={(e) => setProfile({
                  ...profile, 
                  healthcareProvider: {...profile.healthcareProvider, address: e.target.value}
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-colors resize-none"
              />
            ) : (
              <p className="text-gray-900">{profile.healthcareProvider.address}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const NotificationsTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Notification Preferences</h3>
        
        <div className="space-y-4">
          {Object.entries(profile.preferences.notifications).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <h4 className="font-medium text-gray-900">
                  {key === 'dailyCheckins' && 'Daily Check-ins'}
                  {key === 'emergencyAlerts' && 'Emergency Alerts'}
                  {key === 'communityUpdates' && 'Community Updates'}
                  {key === 'appointmentReminders' && 'Appointment Reminders'}
                </h4>
                <p className="text-sm text-gray-600">
                  {key === 'dailyCheckins' && 'Receive daily mood and health check-in reminders'}
                  {key === 'emergencyAlerts' && 'Important safety and emergency notifications'}
                  {key === 'communityUpdates' && 'Updates from community discussions and support groups'}
                  {key === 'appointmentReminders' && 'Reminders for healthcare appointments'}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) => setProfile({
                    ...profile,
                    preferences: {
                      ...profile.preferences,
                      notifications: {
                        ...profile.preferences.notifications,
                        [key]: e.target.checked
                      }
                    }
                  })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-rose-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-500"></div>
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const PrivacyTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Privacy Settings</h3>
        
        <div className="space-y-4">
          {Object.entries(profile.preferences.privacy).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <h4 className="font-medium text-gray-900">
                  {key === 'shareDataWithResearchers' && 'Share Data with Researchers'}
                  {key === 'allowCommunityContact' && 'Allow Community Contact'}
                  {key === 'publicProfile' && 'Public Profile'}
                </h4>
                <p className="text-sm text-gray-600">
                  {key === 'shareDataWithResearchers' && 'Help improve postpartum care by sharing anonymized data'}
                  {key === 'allowCommunityContact' && 'Allow other community members to contact you directly'}
                  {key === 'publicProfile' && 'Make your profile visible to other community members'}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) => setProfile({
                    ...profile,
                    preferences: {
                      ...profile.preferences,
                      privacy: {
                        ...profile.preferences.privacy,
                        [key]: e.target.checked
                      }
                    }
                  })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-rose-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-500"></div>
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <div className="flex items-center space-x-3 mb-4">
          <Shield className="h-6 w-6 text-blue-600" />
          <h4 className="font-semibold text-blue-900">Data Protection</h4>
        </div>
        <p className="text-blue-800 text-sm mb-4">
          Your privacy is our priority. All personal health information is encrypted and stored securely. 
          We never share identifiable information without your explicit consent.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium">
            Download Your Data
          </button>
          <button className="border border-blue-300 text-blue-700 hover:bg-blue-50 px-4 py-2 rounded-lg transition-colors text-sm font-medium">
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-4">
          <div className="bg-gradient-to-r from-rose-500 to-pink-500 p-4 rounded-xl">
            <User className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Profile & Settings</h1>
            <p className="text-gray-600">Manage your account information and preferences</p>
          </div>
        </div>
      </div>

      {/* Profile Summary Card */}
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl p-6 text-white mb-8">
        <div className="flex items-center space-x-4">
          <div className="bg-white/20 p-4 rounded-full">
            <User className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">{profile.name}</h2>
            <p className="text-purple-100">{profile.email}</p>
            <div className="flex items-center space-x-4 mt-2 text-sm">
              <div className="flex items-center space-x-1">
                <Calendar className="h-4 w-4" />
                <span>{calculateDaysPostpartum()} days postpartum</span>
              </div>
              <div className="flex items-center space-x-1">
                <Heart className="h-4 w-4" />
                <span>Active member since 2024</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-8">
        {[
          { id: 'profile', name: 'Profile', icon: User },
          { id: 'notifications', name: 'Notifications', icon: Bell },
          { id: 'privacy', name: 'Privacy', icon: Shield },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-rose-500 text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-rose-50 hover:text-rose-600 border border-gray-200'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            <span>{tab.name}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'profile' && <ProfileTab />}
        {activeTab === 'notifications' && <NotificationsTab />}
        {activeTab === 'privacy' && <PrivacyTab />}
      </div>
    </div>
  );
};

export default Profile;