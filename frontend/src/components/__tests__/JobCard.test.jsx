import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import '@testing-library/jest-dom';
import JobCard from '../JobCard';
import { AuthContext } from '../../contexts/AuthContext';
import api from '../../services/api';

// Mock the API module
jest.mock('../../services/api', () => ({
  saveJob: jest.fn(),
  unsaveJob: jest.fn(),
  applyToJob: jest.fn()
}));

// Mock toast notifications
jest.mock('react-hot-toast', () => ({
  success: jest.fn(),
  error: jest.fn()
}));

const mockJob = {
  id: 'job-123',
  title: 'Senior Software Developer',
  company: {
    id: 'company-123',
    name: 'Tech Corp SA',
    logo: 'https://example.com/logo.png'
  },
  location: 'Cape Town',
  province: 'Western Cape',
  jobType: 'FULL_TIME',
  experienceLevel: 'SENIOR',
  salaryMin: 60000,
  salaryMax: 90000,
  description: 'We are looking for an experienced developer...',
  requirements: ['5+ years experience', 'React', 'Node.js'],
  createdAt: new Date().toISOString(),
  isRemote: false,
  isSaved: false,
  hasApplied: false
};

const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  firstName: 'John',
  lastName: 'Doe',
  role: 'JOB_SEEKER'
};

const renderWithAuth = (component, authValue = { user: mockUser, isAuthenticated: true }) => {
  return render(
    <BrowserRouter>
      <AuthContext.Provider value={authValue}>
        {component}
      </AuthContext.Provider>
    </BrowserRouter>
  );
};

describe('JobCard Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render job card with all basic information', () => {
      renderWithAuth(<JobCard job={mockJob} />);

      expect(screen.getByText(mockJob.title)).toBeInTheDocument();
      expect(screen.getByText(mockJob.company.name)).toBeInTheDocument();
      expect(screen.getByText(mockJob.location)).toBeInTheDocument();
      expect(screen.getByText('Full Time')).toBeInTheDocument();
      expect(screen.getByText('Senior')).toBeInTheDocument();
    });

    it('should display salary range correctly', () => {
      renderWithAuth(<JobCard job={mockJob} />);

      expect(screen.getByText(/R60,000 - R90,000/)).toBeInTheDocument();
    });

    it('should show remote badge when job is remote', () => {
      const remoteJob = { ...mockJob, isRemote: true };
      renderWithAuth(<JobCard job={remoteJob} />);

      expect(screen.getByText('Remote')).toBeInTheDocument();
    });

    it('should display company logo if available', () => {
      renderWithAuth(<JobCard job={mockJob} />);

      const logo = screen.getByAltText(`${mockJob.company.name} logo`);
      expect(logo).toBeInTheDocument();
      expect(logo).toHaveAttribute('src', mockJob.company.logo);
    });

    it('should show placeholder when company logo is not available', () => {
      const jobWithoutLogo = {
        ...mockJob,
        company: { ...mockJob.company, logo: null }
      };
      renderWithAuth(<JobCard job={jobWithoutLogo} />);

      expect(screen.getByText('TC')).toBeInTheDocument(); // Initials
    });

    it('should format date correctly', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const jobWithDate = { ...mockJob, createdAt: yesterday.toISOString() };
      
      renderWithAuth(<JobCard job={jobWithDate} />);

      expect(screen.getByText(/1 day ago/)).toBeInTheDocument();
    });
  });

  describe('Save/Unsave Functionality', () => {
    it('should show save button when job is not saved', () => {
      renderWithAuth(<JobCard job={mockJob} />);

      const saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).toBeInTheDocument();
    });

    it('should show unsave button when job is saved', () => {
      const savedJob = { ...mockJob, isSaved: true };
      renderWithAuth(<JobCard job={savedJob} />);

      const unsaveButton = screen.getByRole('button', { name: /unsave/i });
      expect(unsaveButton).toBeInTheDocument();
    });

    it('should call saveJob API when save button is clicked', async () => {
      api.saveJob.mockResolvedValue({ success: true });
      const onUpdate = jest.fn();
      
      renderWithAuth(<JobCard job={mockJob} onUpdate={onUpdate} />);

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(api.saveJob).toHaveBeenCalledWith(mockJob.id);
        expect(onUpdate).toHaveBeenCalledWith(mockJob.id, { isSaved: true });
      });
    });

    it('should call unsaveJob API when unsave button is clicked', async () => {
      api.unsaveJob.mockResolvedValue({ success: true });
      const onUpdate = jest.fn();
      const savedJob = { ...mockJob, isSaved: true };
      
      renderWithAuth(<JobCard job={savedJob} onUpdate={onUpdate} />);

      const unsaveButton = screen.getByRole('button', { name: /unsave/i });
      fireEvent.click(unsaveButton);

      await waitFor(() => {
        expect(api.unsaveJob).toHaveBeenCalledWith(mockJob.id);
        expect(onUpdate).toHaveBeenCalledWith(mockJob.id, { isSaved: false });
      });
    });

    it('should handle save error gracefully', async () => {
      api.saveJob.mockRejectedValue(new Error('Network error'));
      
      renderWithAuth(<JobCard job={mockJob} />);

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(api.saveJob).toHaveBeenCalled();
      });
    });
  });

  describe('Apply Functionality', () => {
    it('should show apply button when user has not applied', () => {
      renderWithAuth(<JobCard job={mockJob} />);

      const applyButton = screen.getByRole('button', { name: /apply now/i });
      expect(applyButton).toBeInTheDocument();
    });

    it('should show applied badge when user has applied', () => {
      const appliedJob = { ...mockJob, hasApplied: true };
      renderWithAuth(<JobCard job={appliedJob} />);

      expect(screen.getByText('Applied')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /apply now/i })).not.toBeInTheDocument();
    });

    it('should navigate to job details when apply button is clicked', () => {
      renderWithAuth(<JobCard job={mockJob} />);

      const applyButton = screen.getByRole('button', { name: /apply now/i });
      expect(applyButton).toHaveAttribute('href', `/jobs/${mockJob.id}`);
    });

    it('should not show apply button for employer users', () => {
      const employerUser = { ...mockUser, role: 'EMPLOYER' };
      renderWithAuth(<JobCard job={mockJob} />, { user: employerUser, isAuthenticated: true });

      expect(screen.queryByRole('button', { name: /apply now/i })).not.toBeInTheDocument();
    });
  });

  describe('Authentication', () => {
    it('should show login prompt for unauthenticated users', () => {
      renderWithAuth(<JobCard job={mockJob} />, { user: null, isAuthenticated: false });

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      expect(screen.getByText(/Please login to save jobs/i)).toBeInTheDocument();
    });

    it('should disable apply button for unauthenticated users', () => {
      renderWithAuth(<JobCard job={mockJob} />, { user: null, isAuthenticated: false });

      const applyButton = screen.getByRole('button', { name: /apply now/i });
      expect(applyButton).toHaveAttribute('disabled');
    });
  });

  describe('View Details', () => {
    it('should navigate to job details page when title is clicked', () => {
      renderWithAuth(<JobCard job={mockJob} />);

      const titleLink = screen.getByText(mockJob.title);
      expect(titleLink.closest('a')).toHaveAttribute('href', `/jobs/${mockJob.id}`);
    });

    it('should show view details button', () => {
      renderWithAuth(<JobCard job={mockJob} />);

      const viewButton = screen.getByRole('button', { name: /view details/i });
      expect(viewButton).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('should apply correct classes for mobile view', () => {
      renderWithAuth(<JobCard job={mockJob} />);

      const card = screen.getByTestId('job-card');
      expect(card).toHaveClass('p-4', 'md:p-6');
    });

    it('should show truncated description on mobile', () => {
      const longDescription = 'A'.repeat(200);
      const jobWithLongDesc = { ...mockJob, description: longDescription };
      
      renderWithAuth(<JobCard job={jobWithLongDesc} />);

      const description = screen.getByText(/A+/);
      expect(description).toHaveClass('line-clamp-2', 'md:line-clamp-3');
    });
  });

  describe('Match Score', () => {
    it('should display match score if available', () => {
      const jobWithScore = { ...mockJob, matchScore: 85 };
      renderWithAuth(<JobCard job={jobWithScore} />);

      expect(screen.getByText('85% Match')).toBeInTheDocument();
    });

    it('should show different color for different match scores', () => {
      const highMatch = { ...mockJob, matchScore: 90 };
      renderWithAuth(<JobCard job={highMatch} />);

      const badge = screen.getByText('90% Match');
      expect(badge).toHaveClass('bg-green-100', 'text-green-800');
    });

    it('should not show match score if not available', () => {
      renderWithAuth(<JobCard job={mockJob} />);

      expect(screen.queryByText(/% Match/)).not.toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('should show loading state when saving', async () => {
      api.saveJob.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      
      renderWithAuth(<JobCard job={mockJob} />);

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      expect(saveButton).toHaveAttribute('disabled');
      expect(screen.getByTestId('spinner')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should show error message on API failure', async () => {
      const toast = require('react-hot-toast');
      api.saveJob.mockRejectedValue(new Error('Network error'));
      
      renderWithAuth(<JobCard job={mockJob} />);

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to save job');
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      renderWithAuth(<JobCard job={mockJob} />);

      expect(screen.getByRole('article')).toHaveAttribute('aria-label', `Job listing for ${mockJob.title}`);
      expect(screen.getByRole('button', { name: /save/i })).toHaveAttribute('aria-label', 'Save job');
    });

    it('should be keyboard navigable', () => {
      renderWithAuth(<JobCard job={mockJob} />);

      const saveButton = screen.getByRole('button', { name: /save/i });
      saveButton.focus();
      expect(saveButton).toHaveFocus();

      fireEvent.keyDown(saveButton, { key: 'Enter' });
      expect(api.saveJob).toHaveBeenCalled();
    });
  });
});
