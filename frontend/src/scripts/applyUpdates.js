/**
 * Apply Updates Script
 * This script will replace all existing pages with the updated versions
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pagesDir = path.join(__dirname, '..', 'pages');
const updatedDir = path.join(pagesDir, 'updated');
const backupDir = path.join(pagesDir, 'backup');

// Create backup directory
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

// Page file mappings
const pageFiles = [
  // Navigation Pages
  'AboutPage.jsx',
  'FounderPage.jsx',
  'MissionPage.jsx',
  'ContactPage.jsx',
  'HomePage.jsx',
  'PrivacyPage.jsx',
  'TermsPage.jsx',
  'SuccessStories.jsx',
  
  // Auth Pages
  'Auth.jsx',
  'ForgotPassword.jsx',
  'EmailVerification.jsx',
  
  // Dashboard Pages
  'Dashboard.jsx',
  'Admin.jsx',
  'Analytics.jsx',
  'PredictiveAnalytics.jsx',
  
  // Job Pages
  'Jobs.jsx',
  'JobDetail.jsx',
  'Applications.jsx',
  'AdvancedMatching.jsx',
  'CompanyIntelligence.jsx',
  
  // Profile Pages
  'Profile.jsx',
  'Settings.jsx',
  'Preferences.jsx',
  'Notifications.jsx',
  'Alerts.jsx',
  
  // Payment Pages
  'Payment.jsx',
  'PaymentSuccess.jsx',
  'PaymentFailure.jsx',
  'PaymentCancelled.jsx',
  'Billing.jsx',
  
  // Utility Pages
  'APIDocumentation.jsx',
  'Blog.jsx',
  'Changelog.jsx',
  'ComingSoon.jsx',
  'CvBuilder.jsx',
  'DataPrivacy.jsx',
  'Help.jsx',
  'Integrations.jsx',
  'Maintenance.jsx',
  'NewsletterInsights.jsx',
  'NotFound.jsx',
  'Onboarding.jsx',
  'SkillsAssessment.jsx',
  'Support.jsx',
  'WidgetsDemo.jsx',
  'AIWriting.jsx'
];

let successCount = 0;
let backupCount = 0;
let updateCount = 0;

console.log('Starting page update process...\n');

// Process each page
pageFiles.forEach(fileName => {
  const originalPath = path.join(pagesDir, fileName);
  const updatedPath = path.join(updatedDir, fileName.replace('.jsx', '_updated.jsx'));
  const backupPath = path.join(backupDir, fileName);
  
  try {
    // Check if original file exists
    if (fs.existsSync(originalPath)) {
      // Backup original file
      console.log(`Backing up ${fileName}...`);
      fs.copyFileSync(originalPath, backupPath);
      backupCount++;
    }
    
    // Check if updated file exists
    if (fs.existsSync(updatedPath)) {
      // Read updated content
      const updatedContent = fs.readFileSync(updatedPath, 'utf8');
      
      // Write to original location
      console.log(`Updating ${fileName}...`);
      fs.writeFileSync(originalPath, updatedContent, 'utf8');
      updateCount++;
      successCount++;
    } else {
      console.log(`Warning: Updated file not found for ${fileName}`);
    }
  } catch (error) {
    console.error(`Error processing ${fileName}:`, error.message);
  }
});

console.log(`
==================================================
 Page Update Complete!
==================================================

 Summary:
- Total pages processed: ${pageFiles.length}
- Successfully updated: ${successCount}
- Files backed up: ${backupCount}
- Files replaced: ${updateCount}

 Backup location: frontend/src/pages/backup/
 Updated pages: frontend/src/pages/

Next steps:
1. Test the application to ensure all pages load correctly
2. Verify navigation between pages
3. Check that the PageWrapper is applied consistently
4. If issues occur, backups are available in the backup folder

To restore backups if needed:
- Copy files from frontend/src/pages/backup/ back to frontend/src/pages/
`);
