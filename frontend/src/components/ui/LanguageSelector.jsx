import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { languages } from '../../i18n/i18n';
import './LanguageSelector.css';

/**
 * LanguageSelector Component
 * Dropdown selector for switching between 11 South African languages
 */
const LanguageSelector = ({ className = '' }) => {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState(
    languages.find(lang => lang.code === i18n.language) || languages[0]
  );
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLanguageChange = (language) => {
    i18n.changeLanguage(language.code);
    setSelectedLanguage(language);
    setIsOpen(false);
    
    // Store language preference
    localStorage.setItem('preferredLanguage', language.code);
    
    // Announce change for screen readers
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.className = 'sr-only';
    announcement.textContent = `Language changed to ${language.name}`;
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 1000);
  };

  return (
    <div className={`language-selector ${className}`} ref={dropdownRef}>
      <button
        className="language-selector__trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Select language"
      >
        <span className="language-selector__flag">{selectedLanguage.flag}</span>
        <span className="language-selector__name">{selectedLanguage.name}</span>
        <svg 
          className={`language-selector__arrow ${isOpen ? 'language-selector__arrow--open' : ''}`}
          width="12" 
          height="8" 
          viewBox="0 0 12 8" 
          fill="none"
        >
          <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>

      {isOpen && (
        <div className="language-selector__dropdown" role="listbox">
          <div className="language-selector__options">
            {languages.map((language) => (
              <button
                key={language.code}
                className={`language-selector__option ${
                  selectedLanguage.code === language.code ? 'language-selector__option--selected' : ''
                }`}
                onClick={() => handleLanguageChange(language)}
                role="option"
                aria-selected={selectedLanguage.code === language.code}
              >
                <span className="language-selector__flag">{language.flag}</span>
                <span className="language-selector__name">{language.name}</span>
                {selectedLanguage.code === language.code && (
                  <svg 
                    className="language-selector__check" 
                    width="16" 
                    height="16" 
                    viewBox="0 0 16 16" 
                    fill="none"
                  >
                    <path 
                      d="M13.5 4.5L6 12L2.5 8.5" 
                      stroke="var(--accent-cyan)" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;
