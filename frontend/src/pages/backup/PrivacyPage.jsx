import React from 'react'
import { Shield, Lock, Eye, Database, UserCheck, AlertCircle, Mail, Globe } from 'lucide-react'

const PrivacyPage = () => {
  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <Shield className="h-16 w-16 text-cyan-400 mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-white mb-4">Privacy Policy</h1>
          <p className="text-gray-300 text-lg">
            Your privacy is important to us. This policy explains how we collect, use, and protect your information.
          </p>
          <p className="text-gray-400 mt-2">Last updated: August 31, 2025</p>
        </div>

        {/* POPIA Compliance Notice */}
        <div className="bg-cyan-900/20 border border-cyan-500/30 rounded-lg p-6 mb-8">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-6 w-6 text-cyan-400 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-lg font-semibold text-cyan-400 mb-2">POPIA Compliance</h3>
              <p className="text-gray-300">
                AI Job Chommie is fully compliant with the Protection of Personal Information Act (POPIA) of South Africa. 
                We are committed to protecting your personal information and ensuring your rights are respected.
              </p>
            </div>
          </div>
        </div>

        {/* Content Sections */}
        <div className="space-y-8">
          {/* Information We Collect */}
          <section className="bg-black/30 backdrop-blur-sm rounded-lg p-6 border border-white/10">
            <div className="flex items-center mb-4">
              <Database className="h-6 w-6 text-cyan-400 mr-3" />
              <h2 className="text-2xl font-semibold text-white">Information We Collect</h2>
            </div>
            <div className="space-y-4 text-gray-300">
              <div>
                <h3 className="font-semibold text-white mb-2">Personal Information</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Name, email address, and contact details</li>
                  <li>Employment history and educational background</li>
                  <li>Skills, qualifications, and certifications</li>
                  <li>CV/Resume documents you upload</li>
                  <li>Job preferences and search criteria</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-white mb-2">Usage Information</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Job searches and applications</li>
                  <li>Platform usage patterns and preferences</li>
                  <li>Device and browser information</li>
                  <li>IP address and location data (city level only)</li>
                </ul>
              </div>
            </div>
          </section>

          {/* How We Use Your Information */}
          <section className="bg-black/30 backdrop-blur-sm rounded-lg p-6 border border-white/10">
            <div className="flex items-center mb-4">
              <Eye className="h-6 w-6 text-cyan-400 mr-3" />
              <h2 className="text-2xl font-semibold text-white">How We Use Your Information</h2>
            </div>
            <div className="space-y-3 text-gray-300">
              <p>We use your information to:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Match you with relevant job opportunities</li>
                <li>Facilitate job applications to employers</li>
                <li>Improve our AI matching algorithms</li>
                <li>Send job alerts and notifications (with your consent)</li>
                <li>Provide customer support</li>
                <li>Comply with legal obligations</li>
                <li>Prevent fraud and ensure platform security</li>
              </ul>
            </div>
          </section>

          {/* Data Protection */}
          <section className="bg-black/30 backdrop-blur-sm rounded-lg p-6 border border-white/10">
            <div className="flex items-center mb-4">
              <Lock className="h-6 w-6 text-cyan-400 mr-3" />
              <h2 className="text-2xl font-semibold text-white">Data Protection & Security</h2>
            </div>
            <div className="space-y-3 text-gray-300">
              <p>We implement industry-standard security measures including:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>256-bit SSL encryption for data transmission</li>
                <li>Encrypted storage of sensitive information</li>
                <li>Regular security audits and penetration testing</li>
                <li>Access controls and authentication systems</li>
                <li>Regular backups and disaster recovery procedures</li>
                <li>Employee training on data protection</li>
              </ul>
            </div>
          </section>

          {/* Your Rights */}
          <section className="bg-black/30 backdrop-blur-sm rounded-lg p-6 border border-white/10">
            <div className="flex items-center mb-4">
              <UserCheck className="h-6 w-6 text-cyan-400 mr-3" />
              <h2 className="text-2xl font-semibold text-white">Your Rights Under POPIA</h2>
            </div>
            <div className="space-y-3 text-gray-300">
              <p>You have the right to:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Access your personal information</li>
                <li>Correct or update your information</li>
                <li>Request deletion of your data</li>
                <li>Object to processing of your information</li>
                <li>Data portability (export your data)</li>
                <li>Withdraw consent at any time</li>
                <li>Lodge a complaint with the Information Regulator</li>
              </ul>
              <p className="mt-4">
                To exercise any of these rights, please contact us at{' '}
                <a href="mailto:privacy@aijobchommie.co.za" className="text-cyan-400 hover:underline">
                  privacy@aijobchommie.co.za
                </a>
              </p>
            </div>
          </section>

          {/* Data Sharing */}
          <section className="bg-black/30 backdrop-blur-sm rounded-lg p-6 border border-white/10">
            <div className="flex items-center mb-4">
              <Globe className="h-6 w-6 text-cyan-400 mr-3" />
              <h2 className="text-2xl font-semibold text-white">Data Sharing</h2>
            </div>
            <div className="space-y-3 text-gray-300">
              <p>We may share your information with:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Employers (only when you apply for their jobs)</li>
                <li>Service providers who assist our operations</li>
                <li>Legal authorities when required by law</li>
              </ul>
              <p className="mt-4 font-semibold">We NEVER:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Sell your personal information</li>
                <li>Share your CV without your consent</li>
                <li>Use your data for unrelated marketing</li>
              </ul>
            </div>
          </section>

          {/* Data Retention */}
          <section className="bg-black/30 backdrop-blur-sm rounded-lg p-6 border border-white/10">
            <div className="flex items-center mb-4">
              <Database className="h-6 w-6 text-cyan-400 mr-3" />
              <h2 className="text-2xl font-semibold text-white">Data Retention</h2>
            </div>
            <div className="space-y-3 text-gray-300">
              <p>We retain your information for:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Active accounts: As long as your account is active</li>
                <li>Job applications: 12 months after application</li>
                <li>Inactive accounts: 24 months, then automatically deleted</li>
                <li>Legal compliance: As required by South African law</li>
              </ul>
              <p className="mt-4">
                You can request immediate deletion of your account and data at any time.
              </p>
            </div>
          </section>

          {/* Cookies */}
          <section className="bg-black/30 backdrop-blur-sm rounded-lg p-6 border border-white/10">
            <div className="flex items-center mb-4">
              <Globe className="h-6 w-6 text-cyan-400 mr-3" />
              <h2 className="text-2xl font-semibold text-white">Cookies & Tracking</h2>
            </div>
            <div className="space-y-3 text-gray-300">
              <p>We use cookies to:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Keep you logged in</li>
                <li>Remember your preferences</li>
                <li>Analyze platform usage (anonymized)</li>
                <li>Improve our services</li>
              </ul>
              <p className="mt-4">
                You can control cookies through your browser settings. Note that disabling cookies may affect platform functionality.
              </p>
            </div>
          </section>

          {/* Children's Privacy */}
          <section className="bg-black/30 backdrop-blur-sm rounded-lg p-6 border border-white/10">
            <div className="flex items-center mb-4">
              <UserCheck className="h-6 w-6 text-cyan-400 mr-3" />
              <h2 className="text-2xl font-semibold text-white">Children's Privacy</h2>
            </div>
            <div className="text-gray-300">
              <p>
                Our services are not intended for individuals under 18 years of age. 
                We do not knowingly collect personal information from children.
              </p>
            </div>
          </section>

          {/* Updates to Policy */}
          <section className="bg-black/30 backdrop-blur-sm rounded-lg p-6 border border-white/10">
            <div className="flex items-center mb-4">
              <AlertCircle className="h-6 w-6 text-cyan-400 mr-3" />
              <h2 className="text-2xl font-semibold text-white">Updates to This Policy</h2>
            </div>
            <div className="text-gray-300">
              <p>
                We may update this privacy policy from time to time. We will notify you of any significant changes 
                via email or platform notification. Continued use of our services after changes constitutes acceptance 
                of the updated policy.
              </p>
            </div>
          </section>

          {/* Contact Information */}
          <section className="bg-black/30 backdrop-blur-sm rounded-lg p-6 border border-white/10">
            <div className="flex items-center mb-4">
              <Mail className="h-6 w-6 text-cyan-400 mr-3" />
              <h2 className="text-2xl font-semibold text-white">Contact Us</h2>
            </div>
            <div className="space-y-3 text-gray-300">
              <p>For privacy-related questions or concerns:</p>
              <div className="space-y-2 ml-4">
                <p>
                  <strong>Email:</strong>{' '}
                  <a href="mailto:privacy@aijobchommie.co.za" className="text-cyan-400 hover:underline">
                    privacy@aijobchommie.co.za
                  </a>
                </p>
                <p>
                  <strong>Phone:</strong> +27 (0) 10 123 4567
                </p>
                <p>
                  <strong>Address:</strong> AI Job Chommie (Pty) Ltd<br />
                  123 Tech Street, Sandton<br />
                  Johannesburg, 2196<br />
                  South Africa
                </p>
              </div>
              <div className="mt-6 p-4 bg-cyan-900/20 border border-cyan-500/30 rounded">
                <p className="font-semibold text-cyan-400 mb-2">Information Regulator Contact:</p>
                <p className="text-sm">
                  The Information Regulator (South Africa)<br />
                  SALU Building, 316 Thabo Sehume Street, Pretoria<br />
                  Email: inforeg@justice.gov.za<br />
                  Website: www.justice.gov.za/inforeg
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Registration Info */}
        <div className="mt-12 text-center text-gray-400 text-sm">
          <p>AI Job Chommie (Pty) Ltd</p>
          <p>Registration: 2025/599261/07 | Tax Reference: 9481880228</p>
          <p>© {new Date().getFullYear()} All rights reserved</p>
        </div>
      </div>
    </div>
  )
}

export default PrivacyPage
