import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  User, Mail, Phone, MapPin, Briefcase, GraduationCap, Award, Globe, 
  Linkedin, Github, Edit3, Save, Upload, FileText, Download, Share2, 
  Camera, Plus, Building, Shield, Eye, CheckCircle, Loader2, X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const ProfilePage = () => {
  const { user, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(false);
  const accountType = user?.accountType || 'job_seeker';
  
  const [profileData, setProfileData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '',
    location: user?.location || '',
    headline: user?.headline || '',
    bio: user?.bio || '',
    skills: user?.skills || [],
    experience: user?.experience || [],
    education: user?.education || {},
    links: user?.links || {},
    resume: user?.resume || null,
    companyName: user?.companyName || '',
    companySize: user?.companySize || '',
    industry: user?.industry || ''
  });

  const saveProfile = async () => {
    setIsLoading(true);
    try {
      await updateProfile(profileData);
      setIsEditing(false);
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = accountType === 'job_seeker' 
    ? [
        { id: 'overview', label: 'Overview', icon: User },
        { id: 'experience', label: 'Experience', icon: Briefcase },
        { id: 'skills', label: 'Skills', icon: Award },
        { id: 'portfolio', label: 'Portfolio', icon: Globe },
        { id: 'privacy', label: 'Privacy', icon: Shield }
      ]
    : [
        { id: 'overview', label: 'Company', icon: Building },
        { id: 'culture', label: 'Culture', icon: Award },
        { id: 'jobs', label: 'Jobs', icon: Briefcase },
        { id: 'privacy', label: 'Privacy', icon: Shield }
      ];

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Your Profile</h1>
          <p className="text-gray-400">Manage your professional information</p>
        </div>

        {/* Tabs */}
        <div className="mb-8 border-b border-gray-800">
          <div className="flex gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-3 flex items-center gap-2 border-b-2 ${
                    activeTab === tab.id
                      ? 'text-cyan-400 border-cyan-400'
                      : 'text-gray-400 border-transparent'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="bg-gray-900/50 backdrop-blur-xl rounded-2xl p-8 border border-gray-800">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="flex items-start gap-6">
                <div className="relative">
                  <div className="w-32 h-32 rounded-full bg-gray-800 flex items-center justify-center">
                    <User className="h-12 w-12 text-gray-500" />
                  </div>
                  {isEditing && (
                    <button className="absolute bottom-0 right-0 p-2 bg-cyan-500 rounded-full">
                      <Camera className="h-4 w-4 text-white" />
                    </button>
                  )}
                </div>
                <div className="flex-1">
                  {isEditing ? (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={profileData.headline}
                        onChange={(e) => setProfileData({...profileData, headline: e.target.value})}
                        className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white"
                        placeholder="Professional Headline"
                      />
                      <textarea
                        value={profileData.bio}
                        onChange={(e) => setProfileData({...profileData, bio: e.target.value})}
                        className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white"
                        placeholder="Bio"
                        rows={4}
                      />
                    </div>
                  ) : (
                    <>
                      <h2 className="text-2xl font-bold text-white mb-2">
                        {profileData.firstName} {profileData.lastName}
                      </h2>
                      <p className="text-cyan-400 mb-2">{profileData.headline}</p>
                      <p className="text-gray-300">{profileData.bio}</p>
                    </>
                  )}
                </div>
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 bg-cyan-500 text-white rounded-lg flex items-center gap-2"
                  >
                    <Edit3 className="h-4 w-4" />
                    Edit
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 bg-gray-700 text-white rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveProfile}
                      disabled={isLoading}
                      className="px-4 py-2 bg-cyan-500 text-white rounded-lg flex items-center gap-2"
                    >
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Save
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4 pt-6 border-t border-gray-800">
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">{profileData.skills?.length || 0}</p>
                  <p className="text-sm text-gray-400">Skills</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-cyan-400">{profileData.experience?.length || 0}</p>
                  <p className="text-sm text-gray-400">Experiences</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-400">100%</p>
                  <p className="text-sm text-gray-400">Complete</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'skills' && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-white">Skills & Expertise</h3>
              <div className="flex flex-wrap gap-2">
                {profileData.skills.map((skill, index) => (
                  <span key={index} className="px-3 py-1 bg-cyan-500/20 border border-cyan-500/50 rounded-full text-cyan-400">
                    {skill}
                  </span>
                ))}
                {isEditing && (
                  <button className="px-3 py-1 border border-gray-700 rounded-full text-gray-400 hover:border-cyan-400">
                    <Plus className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-white">Privacy Settings</h3>
              <div className="space-y-4">
                <label className="flex items-center justify-between">
                  <span className="text-gray-300">Profile Visibility</span>
                  <select className="px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white">
                    <option>Public</option>
                    <option>Connections Only</option>
                    <option>Private</option>
                  </select>
                </label>
                <label className="flex items-center justify-between">
                  <span className="text-gray-300">Show Email</span>
                  <input type="checkbox" className="rounded text-cyan-400" />
                </label>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
