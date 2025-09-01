"""
Text processing utilities for job scraping and data extraction.
"""

import re
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta


class TextProcessor:
    """Text processing utilities for job data extraction and cleaning."""
    
    def __init__(self):
        # Common job-related keywords for extraction
        self.requirement_keywords = [
            "require", "must have", "essential", "mandatory", "minimum",
            "bachelor", "master", "degree", "diploma", "certification",
            "experience", "years", "skills", "knowledge", "proficient"
        ]
        
        self.skill_keywords = [
            "python", "java", "javascript", "react", "node", "sql", "aws",
            "docker", "kubernetes", "git", "agile", "scrum", "api", "rest",
            "html", "css", "mongodb", "postgresql", "redis", "linux"
        ]
    
    def extract_structured_from_snippet(self, text: str) -> Dict[str, Any]:
        """Extract structured data from job description snippet."""
        if not text:
            return {}
        
        result = {
            "requirements": self._extract_requirements(text),
            "skills": self._extract_skills(text),
            "benefits": self._extract_benefits(text)
        }
        
        return {k: v for k, v in result.items() if v}  # Remove empty lists
    
    def _extract_requirements(self, text: str) -> List[str]:
        """Extract job requirements from text."""
        requirements = []
        text_lower = text.lower()
        
        # Find sentences containing requirement keywords
        sentences = re.split(r'[.!?]+', text)
        
        for sentence in sentences:
            sentence_lower = sentence.lower().strip()
            if any(keyword in sentence_lower for keyword in self.requirement_keywords):
                # Clean and add requirement
                cleaned = self._clean_requirement_text(sentence.strip())
                if cleaned and len(cleaned) > 10:
                    requirements.append(cleaned)
        
        return requirements[:5]  # Limit to top 5 requirements
    
    def _extract_skills(self, text: str) -> List[str]:
        """Extract technical skills from text."""
        skills = []
        text_lower = text.lower()
        
        # Look for skill keywords
        for skill in self.skill_keywords:
            if skill in text_lower:
                skills.append(skill.title())
        
        # Extract years of experience
        experience_match = re.search(r'(\d+)\s*\+?\s*years?\s*(of\s*)?experience', text_lower)
        if experience_match:
            years = experience_match.group(1)
            skills.append(f"{years}+ years experience")
        
        return list(set(skills))  # Remove duplicates
    
    def _extract_benefits(self, text: str) -> List[str]:
        """Extract job benefits from text."""
        benefits = []
        text_lower = text.lower()
        
        benefit_keywords = [
            "medical aid", "pension", "bonus", "commission", "flexible hours",
            "remote work", "work from home", "training", "development",
            "career growth", "insurance", "leave", "vacation"
        ]
        
        for benefit in benefit_keywords:
            if benefit in text_lower:
                benefits.append(benefit.title())
        
        return list(set(benefits))
    
    def _clean_requirement_text(self, text: str) -> str:
        """Clean requirement text."""
        # Remove HTML tags
        text = re.sub(r'<[^>]+>', '', text)
        
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        
        # Remove special characters at start/end
        text = re.sub(r'^[^\w]+|[^\w]+$', '', text)
        
        return text
    
    def parse_relative_date(self, date_text: str) -> str:
        """Parse relative date strings like '2 days ago' to ISO format."""
        if not date_text:
            return datetime.utcnow().isoformat()
        
        date_text_lower = date_text.lower().strip()
        now = datetime.utcnow()
        
        # Handle common patterns
        if "today" in date_text_lower:
            return now.isoformat()
        elif "yesterday" in date_text_lower:
            return (now - timedelta(days=1)).isoformat()
        elif "hour" in date_text_lower:
            hours_match = re.search(r'(\d+)\s*hours?', date_text_lower)
            if hours_match:
                hours = int(hours_match.group(1))
                return (now - timedelta(hours=hours)).isoformat()
        elif "day" in date_text_lower:
            days_match = re.search(r'(\d+)\s*days?', date_text_lower)
            if days_match:
                days = int(days_match.group(1))
                return (now - timedelta(days=days)).isoformat()
        elif "week" in date_text_lower:
            weeks_match = re.search(r'(\d+)\s*weeks?', date_text_lower)
            if weeks_match:
                weeks = int(weeks_match.group(1))
                return (now - timedelta(weeks=weeks)).isoformat()
        elif "month" in date_text_lower:
            months_match = re.search(r'(\d+)\s*months?', date_text_lower)
            if months_match:
                months = int(months_match.group(1))
                return (now - timedelta(days=months * 30)).isoformat()
        
        # Default to current time if can't parse
        return now.isoformat()
    
    def clean_job_title(self, title: str) -> str:
        """Clean and normalize job title."""
        if not title:
            return ""
        
        # Remove common suffixes/prefixes
        title = re.sub(r'\s*-\s*(Indeed|LinkedIn|Glassdoor|Jobs).*$', '', title, flags=re.IGNORECASE)
        title = re.sub(r'^Job:\s*', '', title, flags=re.IGNORECASE)
        title = re.sub(r'\s*\|\s*.*$', '', title)
        
        # Clean whitespace
        title = re.sub(r'\s+', ' ', title).strip()
        
        return title
    
    def extract_location_parts(self, location: str) -> Dict[str, str]:
        """Extract city, province, country from location string."""
        if not location:
            return {"city": "", "province": "", "country": "South Africa"}
        
        parts = [part.strip() for part in location.split(',')]
        
        result = {"city": "", "province": "", "country": "South Africa"}
        
        if len(parts) >= 1:
            result["city"] = parts[0]
        if len(parts) >= 2:
            result["province"] = parts[1]
        if len(parts) >= 3 and parts[2].lower() not in ["za", "south africa"]:
            result["country"] = parts[2]
        
        return result
