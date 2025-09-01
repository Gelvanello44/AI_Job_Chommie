"""
Job enrichment processor with skill extraction, salary normalization, and metadata enhancement.
"""

import re
import asyncio
from typing import Dict, List, Any, Optional, Set, Tuple
from datetime import datetime
import statistics
from dataclasses import dataclass

from src.models.job_models import Job
from src.config.sentry import capture_api_error, add_scraping_breadcrumb


@dataclass
class EnrichedJobData:
    """Enriched job data structure."""
    job_id: str
    original_data: Dict[str, Any]
    enriched_fields: Dict[str, Any]
    enrichment_metadata: Dict[str, Any]
    processed_at: datetime


class SkillExtractor:
    """Advanced skill extraction from job descriptions."""
    
    def __init__(self):
        self.programming_languages = {
            'python', 'java', 'javascript', 'typescript', 'c++', 'c#', 'php',
            'ruby', 'go', 'rust', 'swift', 'kotlin', 'scala', 'r', 'matlab',
            'perl', 'shell', 'bash', 'powershell', 'objective-c', 'dart',
            'clojure', 'haskell', 'erlang', 'elixir', 'groovy', 'lua'
        }
        
        self.web_technologies = {
            'html', 'css', 'sass', 'scss', 'less', 'bootstrap', 'tailwind',
            'react', 'angular', 'vue', 'svelte', 'jquery', 'backbone',
            'ember', 'nodejs', 'nextjs', 'nuxtjs', 'gatsby', 'webpack'
        }
        
        self.frameworks_libraries = {
            'django', 'flask', 'fastapi', 'spring', 'express', 'rails',
            'laravel', 'codeigniter', 'symfony', 'asp.net', '.net', 'xamarin',
            'unity', 'unreal', 'tensorflow', 'pytorch', 'keras', 'scikit-learn',
            'pandas', 'numpy', 'matplotlib', 'seaborn', 'plotly'
        }
        
        self.databases = {
            'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch',
            'cassandra', 'dynamodb', 'sqlite', 'oracle', 'sql server',
            'mariadb', 'couchdb', 'neo4j', 'influxdb', 'clickhouse'
        }
        
        self.cloud_platforms = {
            'aws', 'azure', 'gcp', 'google cloud', 'heroku', 'digitalocean',
            'linode', 'vultr', 'cloudflare', 'vercel', 'netlify'
        }
        
        self.devops_tools = {
            'docker', 'kubernetes', 'jenkins', 'gitlab ci', 'github actions',
            'terraform', 'ansible', 'chef', 'puppet', 'vagrant', 'helm',
            'prometheus', 'grafana', 'elk stack', 'datadog', 'new relic'
        }
        
        self.soft_skills = {
            'leadership', 'communication', 'problem solving', 'teamwork',
            'project management', 'agile', 'scrum', 'kanban', 'analytical thinking',
            'creativity', 'adaptability', 'time management', 'mentoring'
        }
        
        self.certifications = {
            'aws certified', 'azure certified', 'google cloud certified',
            'cissp', 'ceh', 'pmp', 'csm', 'cka', 'ckad', 'rhce', 'mcse'
        }
        
        # Compile regex patterns for better performance
        self._compile_patterns()
    
    def _compile_patterns(self):
        """Compile regex patterns for skill matching."""
        self.skill_patterns = {}
        
        all_skills = (
            self.programming_languages | self.web_technologies |
            self.frameworks_libraries | self.databases |
            self.cloud_platforms | self.devops_tools |
            self.soft_skills | self.certifications
        )
        
        for skill in all_skills:
            # Create pattern that matches skill as whole word (case insensitive)
            pattern = re.compile(r'\b' + re.escape(skill) + r'\b', re.IGNORECASE)
            self.skill_patterns[skill] = pattern
    
    def extract_skills(self, text: str) -> Dict[str, List[str]]:
        """Extract skills from job description text."""
        
        if not text:
            return {}
        
        extracted_skills = {
            'programming_languages': [],
            'web_technologies': [],
            'frameworks_libraries': [],
            'databases': [],
            'cloud_platforms': [],
            'devops_tools': [],
            'soft_skills': [],
            'certifications': [],
            'other': []
        }
        
        text_lower = text.lower()
        
        # Extract skills by category
        for skill, pattern in self.skill_patterns.items():
            if pattern.search(text):
                if skill in self.programming_languages:
                    extracted_skills['programming_languages'].append(skill)
                elif skill in self.web_technologies:
                    extracted_skills['web_technologies'].append(skill)
                elif skill in self.frameworks_libraries:
                    extracted_skills['frameworks_libraries'].append(skill)
                elif skill in self.databases:
                    extracted_skills['databases'].append(skill)
                elif skill in self.cloud_platforms:
                    extracted_skills['cloud_platforms'].append(skill)
                elif skill in self.devops_tools:
                    extracted_skills['devops_tools'].append(skill)
                elif skill in self.soft_skills:
                    extracted_skills['soft_skills'].append(skill)
                elif skill in self.certifications:
                    extracted_skills['certifications'].append(skill)
        
        # Extract years of experience requirements
        extracted_skills['experience_requirements'] = self._extract_experience_years(text)
        
        # Extract degree requirements
        extracted_skills['education_requirements'] = self._extract_education(text)
        
        # Remove duplicates and empty categories
        for category in extracted_skills:
            if isinstance(extracted_skills[category], list):
                extracted_skills[category] = list(set(extracted_skills[category]))
        
        # Remove empty categories
        extracted_skills = {k: v for k, v in extracted_skills.items() if v}
        
        return extracted_skills
    
    def _extract_experience_years(self, text: str) -> List[str]:
        """Extract experience year requirements."""
        
        experience_patterns = [
            r'(\d+)\+?\s*years?\s*(?:of\s*)?experience',
            r'(\d+)\+?\s*years?\s*in',
            r'minimum\s*(\d+)\s*years?',
            r'at\s*least\s*(\d+)\s*years?',
            r'(\d+)\-(\d+)\s*years?'
        ]
        
        experience_reqs = []
        
        for pattern in experience_patterns:
            matches = re.findall(pattern, text.lower())
            for match in matches:
                if isinstance(match, tuple):
                    experience_reqs.append(f"{match[0]}-{match[1]} years")
                else:
                    experience_reqs.append(f"{match}+ years")
        
        return list(set(experience_reqs))
    
    def _extract_education(self, text: str) -> List[str]:
        """Extract education requirements."""
        
        education_patterns = {
            r'\b(?:bachelor\'?s?|bs|ba)\b.*?(?:degree|diploma)': "Bachelor's Degree",
            r'\b(?:master\'?s?|ms|ma|mba)\b.*?(?:degree|diploma)': "Master's Degree",
            r'\b(?:phd|ph\.d|doctorate)\b': "PhD/Doctorate",
            r'\b(?:associate\'?s?|aa|as)\b.*?(?:degree|diploma)': "Associate's Degree",
            r'\bhigh\s*school\b.*?(?:diploma|graduate)': "High School Diploma",
            r'\b(?:certification|certificate)\b': "Professional Certification"
        }
        
        education_reqs = []
        text_lower = text.lower()
        
        for pattern, education_type in education_patterns.items():
            if re.search(pattern, text_lower):
                education_reqs.append(education_type)
        
        return list(set(education_reqs))


class SalaryNormalizer:
    """Normalize salary information across different formats."""
    
    def __init__(self):
        self.salary_patterns = [
            # Annual salaries
            r'\$(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:k|thousand)?\s*(?:per\s*year|annually|\/year)?',
            r'\$(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*-\s*\$(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:k|thousand)?\s*(?:per\s*year|annually|\/year)?',
            # Hourly rates
            r'\$(\d{1,3}(?:\.\d{2})?)\s*(?:per\s*hour|\/hour|hourly)',
            r'\$(\d{1,3}(?:\.\d{2})?)\s*-\s*\$(\d{1,3}(?:\.\d{2})?)\s*(?:per\s*hour|\/hour|hourly)',
            # K notation
            r'(\d{1,3})k\s*-\s*(\d{1,3})k',
            r'(\d{1,3})k\+?'
        ]
        
        self.salary_regex_patterns = [re.compile(pattern, re.IGNORECASE) for pattern in self.salary_patterns]
    
    def normalize_salary(self, salary_text: str) -> Dict[str, Any]:
        """Normalize salary text into structured data."""
        
        if not salary_text:
            return {}
        
        normalized = {
            'raw_text': salary_text,
            'currency': 'USD',  # Default assumption
            'normalized_at': datetime.utcnow().isoformat()
        }
        
        # Try to extract salary ranges
        salary_info = self._extract_salary_range(salary_text)
        
        if salary_info:
            normalized.update(salary_info)
            
            # Calculate additional metrics
            if normalized.get('annual_min') and normalized.get('annual_max'):
                normalized['annual_median'] = (normalized['annual_min'] + normalized['annual_max']) / 2
                normalized['salary_range_width'] = normalized['annual_max'] - normalized['annual_min']
        
        # Extract payment frequency
        normalized['payment_frequency'] = self._extract_payment_frequency(salary_text)
        
        # Detect benefits mentions
        normalized['benefits_mentioned'] = self._detect_benefits(salary_text)
        
        return normalized
    
    def _extract_salary_range(self, text: str) -> Optional[Dict[str, Any]]:
        """Extract salary range from text."""
        
        text_clean = re.sub(r'[^\w\s\$,.-]', '', text.lower())
        
        for pattern in self.salary_regex_patterns:
            match = pattern.search(text_clean)
            
            if match:
                groups = match.groups()
                
                if len(groups) == 2:  # Range format
                    min_val = self._parse_salary_value(groups[0])
                    max_val = self._parse_salary_value(groups[1])
                    
                    if min_val and max_val:
                        # Convert to annual if hourly
                        if 'hour' in text.lower():
                            min_val *= 2080  # 40 hours/week * 52 weeks
                            max_val *= 2080
                        
                        # Handle K notation
                        if 'k' in text.lower():
                            min_val *= 1000
                            max_val *= 1000
                        
                        return {
                            'annual_min': int(min_val),
                            'annual_max': int(max_val),
                            'type': 'range'
                        }
                
                elif len(groups) == 1:  # Single value
                    val = self._parse_salary_value(groups[0])
                    
                    if val:
                        # Convert to annual if hourly
                        if 'hour' in text.lower():
                            val *= 2080
                        
                        # Handle K notation
                        if 'k' in text.lower():
                            val *= 1000
                        
                        if 'minimum' in text.lower() or 'starting' in text.lower():
                            return {
                                'annual_min': int(val),
                                'type': 'minimum'
                            }
                        else:
                            return {
                                'annual_min': int(val * 0.9),  # Estimate range
                                'annual_max': int(val * 1.1),
                                'type': 'estimated_range'
                            }
        
        return None
    
    def _parse_salary_value(self, value_str: str) -> Optional[float]:
        """Parse salary value string to float."""
        
        try:
            # Remove common formatting
            clean_value = re.sub(r'[^\d.]', '', str(value_str))
            return float(clean_value)
        except (ValueError, TypeError):
            return None
    
    def _extract_payment_frequency(self, text: str) -> str:
        """Extract payment frequency from text."""
        
        text_lower = text.lower()
        
        if any(term in text_lower for term in ['annual', 'per year', '/year', 'yearly']):
            return 'annual'
        elif any(term in text_lower for term in ['month', 'monthly', '/month']):
            return 'monthly'
        elif any(term in text_lower for term in ['week', 'weekly', '/week']):
            return 'weekly'
        elif any(term in text_lower for term in ['hour', 'hourly', '/hour']):
            return 'hourly'
        else:
            return 'unknown'
    
    def _detect_benefits(self, text: str) -> List[str]:
        """Detect mentioned benefits in salary text."""
        
        benefit_keywords = {
            'health insurance': ['health', 'medical', 'healthcare'],
            'dental insurance': ['dental'],
            'vision insurance': ['vision'],
            '401k': ['401k', '401(k)', 'retirement'],
            'paid time off': ['pto', 'paid time off', 'vacation'],
            'flexible hours': ['flexible', 'flex time'],
            'remote work': ['remote', 'work from home', 'wfh'],
            'stock options': ['stock', 'equity', 'options'],
            'bonus': ['bonus', 'performance pay']
        }
        
        text_lower = text.lower()
        detected_benefits = []
        
        for benefit, keywords in benefit_keywords.items():
            if any(keyword in text_lower for keyword in keywords):
                detected_benefits.append(benefit)
        
        return detected_benefits


class LocationEnricher:
    """Enrich location information with geographic data."""
    
    def __init__(self):
        # Major tech hubs and their data
        self.tech_hubs = {
            'san francisco': {'state': 'CA', 'country': 'US', 'timezone': 'PST', 'cost_of_living_index': 180},
            'new york': {'state': 'NY', 'country': 'US', 'timezone': 'EST', 'cost_of_living_index': 170},
            'seattle': {'state': 'WA', 'country': 'US', 'timezone': 'PST', 'cost_of_living_index': 160},
            'austin': {'state': 'TX', 'country': 'US', 'timezone': 'CST', 'cost_of_living_index': 110},
            'chicago': {'state': 'IL', 'country': 'US', 'timezone': 'CST', 'cost_of_living_index': 120},
            'boston': {'state': 'MA', 'country': 'US', 'timezone': 'EST', 'cost_of_living_index': 150},
            'denver': {'state': 'CO', 'country': 'US', 'timezone': 'MST', 'cost_of_living_index': 130},
            'los angeles': {'state': 'CA', 'country': 'US', 'timezone': 'PST', 'cost_of_living_index': 165},
            'toronto': {'state': 'ON', 'country': 'CA', 'timezone': 'EST', 'cost_of_living_index': 140},
            'london': {'state': None, 'country': 'UK', 'timezone': 'GMT', 'cost_of_living_index': 155},
            'berlin': {'state': None, 'country': 'DE', 'timezone': 'CET', 'cost_of_living_index': 125},
            'amsterdam': {'state': None, 'country': 'NL', 'timezone': 'CET', 'cost_of_living_index': 145}
        }
        
        self.remote_keywords = [
            'remote', 'anywhere', 'work from home', 'distributed',
            'virtual', 'home office', 'telecommute'
        ]
    
    def enrich_location(self, location_text: str) -> Dict[str, Any]:
        """Enrich location with geographic and economic data."""
        
        if not location_text:
            return {}
        
        enriched = {
            'raw_location': location_text,
            'enriched_at': datetime.utcnow().isoformat()
        }
        
        location_lower = location_text.lower().strip()
        
        # Check for remote work
        if any(keyword in location_lower for keyword in self.remote_keywords):
            enriched.update({
                'is_remote': True,
                'remote_type': self._determine_remote_type(location_text),
                'location_type': 'remote'
            })
            return enriched
        
        # Parse location components
        location_parts = [part.strip() for part in location_text.split(',')]
        
        if len(location_parts) >= 1:
            enriched['city'] = location_parts[0]
        
        if len(location_parts) >= 2:
            enriched['state_or_region'] = location_parts[1]
        
        if len(location_parts) >= 3:
            enriched['country'] = location_parts[2]
        else:
            enriched['country'] = 'US'  # Default assumption
        
        # Check if it's a known tech hub
        city_lower = enriched.get('city', '').lower()
        
        for hub_city, hub_data in self.tech_hubs.items():
            if hub_city in city_lower or city_lower in hub_city:
                enriched.update({
                    'is_tech_hub': True,
                    'timezone': hub_data['timezone'],
                    'cost_of_living_index': hub_data['cost_of_living_index'],
                    'normalized_city': hub_city.title(),
                    'location_type': 'tech_hub'
                })
                break
        else:
            enriched.update({
                'is_tech_hub': False,
                'location_type': 'standard'
            })
        
        return enriched
    
    def _determine_remote_type(self, location_text: str) -> str:
        """Determine the type of remote work."""
        
        text_lower = location_text.lower()
        
        if 'anywhere' in text_lower or 'global' in text_lower:
            return 'fully_remote'
        elif any(state in text_lower for state in ['us only', 'usa', 'united states']):
            return 'remote_us_only'
        elif 'hybrid' in text_lower:
            return 'hybrid'
        else:
            return 'remote'


class JobEnrichmentProcessor:
    """Main job enrichment processor that coordinates all enrichment activities."""
    
    def __init__(self):
        self.skill_extractor = SkillExtractor()
        self.salary_normalizer = SalaryNormalizer()
        self.location_enricher = LocationEnricher()
        
        # Processing statistics
        self.jobs_processed = 0
        self.enrichment_errors = 0
        
        add_scraping_breadcrumb("JobEnrichmentProcessor initialized")
    
    async def enrich_job(self, job: Job) -> EnrichedJobData:
        """Enrich a job with additional data and insights."""
        
        try:
            enriched_fields = {}
            
            # Extract skills from description
            if job.description:
                skills_data = self.skill_extractor.extract_skills(job.description)
                if skills_data:
                    enriched_fields['extracted_skills'] = skills_data
                    
                    # Calculate skill score
                    enriched_fields['skill_diversity_score'] = self._calculate_skill_score(skills_data)
            
            # Normalize salary information
            if job.salary_min or job.salary_max or (job.metadata and job.metadata.get('salary_text')):
                salary_text = job.metadata.get('salary_text', '') if job.metadata else ''
                if not salary_text and (job.salary_min or job.salary_max):
                    if job.salary_min and job.salary_max:
                        salary_text = f"${job.salary_min:,} - ${job.salary_max:,}"
                    elif job.salary_min:
                        salary_text = f"${job.salary_min:,}+"
                    elif job.salary_max:
                        salary_text = f"Up to ${job.salary_max:,}"
                
                salary_data = self.salary_normalizer.normalize_salary(salary_text)
                if salary_data:
                    enriched_fields['normalized_salary'] = salary_data
            
            # Enrich location data
            if job.location:
                location_data = self.location_enricher.enrich_location(job.location)
                if location_data:
                    enriched_fields['enriched_location'] = location_data
            
            # Calculate job attractiveness score
            enriched_fields['job_attractiveness_score'] = await self._calculate_attractiveness_score(
                job, enriched_fields
            )
            
            # Extract key phrases and requirements
            if job.description:
                enriched_fields['key_requirements'] = self._extract_key_requirements(job.description)
                enriched_fields['company_culture_indicators'] = self._extract_culture_indicators(job.description)
            
            # Job classification
            enriched_fields['job_classification'] = self._classify_job(job, enriched_fields)
            
            # Market analysis (placeholder for more complex analysis)
            enriched_fields['market_analysis'] = await self._analyze_job_market_position(job, enriched_fields)
            
            enrichment_metadata = {
                'processor_version': '1.0',
                'enrichment_modules': list(enriched_fields.keys()),
                'processing_duration_ms': 0,  # Would be calculated in real implementation
                'confidence_score': self._calculate_confidence_score(enriched_fields)
            }
            
            self.jobs_processed += 1
            
            add_scraping_breadcrumb(
                f"Job enrichment completed: {job.id}",
                data={
                    'enriched_fields': len(enriched_fields),
                    'confidence_score': enrichment_metadata['confidence_score']
                }
            )
            
            return EnrichedJobData(
                job_id=job.id,
                original_data=job.__dict__,
                enriched_fields=enriched_fields,
                enrichment_metadata=enrichment_metadata,
                processed_at=datetime.utcnow()
            )
        
        except Exception as e:
            self.enrichment_errors += 1
            capture_api_error(
                e,
                endpoint="enrich_job",
                method="ENRICHMENT",
                context={"job_id": job.id}
            )
            
            # Return minimal enriched data even on error
            return EnrichedJobData(
                job_id=job.id,
                original_data=job.__dict__,
                enriched_fields={'error': str(e)},
                enrichment_metadata={'error': True, 'error_message': str(e)},
                processed_at=datetime.utcnow()
            )
    
    def _calculate_skill_score(self, skills_data: Dict[str, List[str]]) -> float:
        """Calculate skill diversity score based on extracted skills."""
        
        total_skills = 0
        category_weights = {
            'programming_languages': 3.0,
            'frameworks_libraries': 2.5,
            'databases': 2.0,
            'cloud_platforms': 2.5,
            'devops_tools': 2.0,
            'web_technologies': 2.0,
            'soft_skills': 1.5,
            'certifications': 3.0
        }
        
        weighted_score = 0
        
        for category, skills in skills_data.items():
            if category in category_weights and isinstance(skills, list):
                skill_count = len(skills)
                total_skills += skill_count
                weighted_score += skill_count * category_weights[category]
        
        # Normalize to 0-100 scale
        if total_skills == 0:
            return 0.0
        
        # Calculate diversity bonus
        category_diversity = len([cat for cat, skills in skills_data.items() if skills])
        diversity_bonus = category_diversity * 0.1
        
        base_score = min(weighted_score / 20.0, 10.0)  # Max base score of 10
        final_score = min((base_score + diversity_bonus) * 10, 100.0)
        
        return round(final_score, 2)
    
    async def _calculate_attractiveness_score(
        self,
        job: Job,
        enriched_fields: Dict[str, Any]
    ) -> float:
        """Calculate overall job attractiveness score."""
        
        score = 50.0  # Base score
        
        # Salary factor
        if enriched_fields.get('normalized_salary'):
            salary_data = enriched_fields['normalized_salary']
            if salary_data.get('annual_median'):
                # Score based on salary ranges (simplified)
                median_salary = salary_data['annual_median']
                if median_salary >= 150000:
                    score += 20
                elif median_salary >= 100000:
                    score += 15
                elif median_salary >= 80000:
                    score += 10
                elif median_salary >= 60000:
                    score += 5
        
        # Location factor
        if enriched_fields.get('enriched_location'):
            location_data = enriched_fields['enriched_location']
            if location_data.get('is_tech_hub'):
                score += 10
            if location_data.get('is_remote'):
                score += 15  # Remote work is highly valued
        
        # Company reputation (placeholder)
        if job.company:
            # Would integrate with company database for actual scoring
            well_known_companies = [
                'google', 'microsoft', 'apple', 'amazon', 'meta', 'netflix',
                'tesla', 'nvidia', 'salesforce', 'uber', 'airbnb'
            ]
            
            if any(company in job.company.lower() for company in well_known_companies):
                score += 15
        
        # Skills complexity
        if enriched_fields.get('skill_diversity_score'):
            skill_score = enriched_fields['skill_diversity_score']
            score += min(skill_score * 0.2, 15)  # Max 15 points from skills
        
        # Remote-friendly bonus
        if job.remote_friendly:
            score += 10
        
        # Job freshness
        if job.posted_date:
            days_old = (datetime.utcnow() - job.posted_date).days
            if days_old <= 1:
                score += 10
            elif days_old <= 7:
                score += 5
            elif days_old > 30:
                score -= 10
        
        return min(max(score, 0), 100)  # Clamp to 0-100
    
    def _extract_key_requirements(self, description: str) -> List[str]:
        """Extract key requirements from job description."""
        
        requirement_patterns = [
            r'(?:required?|must have?|essential):\s*(.+?)(?:\n|$)',
            r'(?:qualifications?):\s*(.+?)(?:\n|$)',
            r'(?:requirements?):\s*(.+?)(?:\n|$)',
            r'(?:minimum requirements?):\s*(.+?)(?:\n|$)'
        ]
        
        requirements = []
        description_lower = description.lower()
        
        for pattern in requirement_patterns:
            matches = re.findall(pattern, description_lower, re.MULTILINE | re.DOTALL)
            for match in matches:
                # Split by bullet points or line breaks
                req_items = re.split(r'[•\-\*\n]', match)
                for item in req_items:
                    item = item.strip()
                    if item and len(item) > 10:  # Filter out very short items
                        requirements.append(item[:200])  # Truncate long items
        
        return requirements[:10]  # Limit to top 10 requirements
    
    def _extract_culture_indicators(self, description: str) -> Dict[str, bool]:
        """Extract company culture indicators from job description."""
        
        culture_indicators = {
            'work_life_balance': False,
            'flexible_schedule': False,
            'collaborative_environment': False,
            'innovation_focused': False,
            'fast_paced': False,
            'learning_opportunities': False,
            'diversity_inclusive': False,
            'startup_culture': False,
            'established_company': False
        }
        
        text_lower = description.lower()
        
        culture_keywords = {
            'work_life_balance': ['work life balance', 'work-life balance', 'flexible hours'],
            'flexible_schedule': ['flexible schedule', 'flexible hours', 'flex time'],
            'collaborative_environment': ['collaborative', 'team player', 'cross-functional'],
            'innovation_focused': ['innovative', 'cutting edge', 'state of the art'],
            'fast_paced': ['fast paced', 'fast-paced', 'dynamic', 'agile environment'],
            'learning_opportunities': ['learning', 'professional development', 'training'],
            'diversity_inclusive': ['diversity', 'inclusive', 'equal opportunity'],
            'startup_culture': ['startup', 'entrepreneurial', 'scrappy'],
            'established_company': ['established', 'fortune 500', 'industry leader']
        }
        
        for indicator, keywords in culture_keywords.items():
            if any(keyword in text_lower for keyword in keywords):
                culture_indicators[indicator] = True
        
        return culture_indicators
    
    def _classify_job(
        self,
        job: Job,
        enriched_fields: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Classify job into categories and levels."""
        
        classification = {
            'primary_category': 'unknown',
            'subcategory': 'unknown',
            'seniority_level': job.experience_level or 'mid-level',
            'is_technical': False,
            'is_management': False,
            'team_size_indicator': 'unknown'
        }
        
        title_lower = job.title.lower()
        description_lower = (job.description or '').lower()
        
        # Technical roles
        if any(term in title_lower for term in [
            'engineer', 'developer', 'programmer', 'architect', 'analyst'
        ]):
            classification['is_technical'] = True
            classification['primary_category'] = 'engineering'
            
            # Subcategories for technical roles
            if any(term in title_lower for term in ['software', 'application', 'web', 'full stack']):
                classification['subcategory'] = 'software_engineering'
            elif any(term in title_lower for term in ['data', 'analytics', 'scientist']):
                classification['subcategory'] = 'data_science'
            elif any(term in title_lower for term in ['devops', 'site reliability', 'infrastructure']):
                classification['subcategory'] = 'devops'
            elif any(term in title_lower for term in ['security', 'cybersecurity']):
                classification['subcategory'] = 'security'
        
        # Management roles
        if any(term in title_lower for term in [
            'manager', 'director', 'lead', 'head', 'vp', 'chief', 'principal'
        ]):
            classification['is_management'] = True
            classification['primary_category'] = 'management'
        
        # Other categories
        if any(term in title_lower for term in ['sales', 'account', 'business development']):
            classification['primary_category'] = 'sales'
        elif any(term in title_lower for term in ['marketing', 'growth', 'content']):
            classification['primary_category'] = 'marketing'
        elif any(term in title_lower for term in ['product', 'pm']):
            classification['primary_category'] = 'product'
        elif any(term in title_lower for term in ['design', 'ui', 'ux']):
            classification['primary_category'] = 'design'
        
        # Team size indicators
        if any(term in description_lower for term in ['small team', 'startup', 'early stage']):
            classification['team_size_indicator'] = 'small'
        elif any(term in description_lower for term in ['large team', 'enterprise', 'fortune']):
            classification['team_size_indicator'] = 'large'
        
        return classification
    
    async def _analyze_job_market_position(
        self,
        job: Job,
        enriched_fields: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Analyze job's position in the market (simplified version)."""
        
        analysis = {
            'market_demand': 'unknown',
            'salary_competitiveness': 'unknown',
            'skill_rarity_score': 0,
            'location_advantage': 'unknown'
        }
        
        # Simplified market demand based on job title keywords
        high_demand_keywords = [
            'machine learning', 'ai', 'kubernetes', 'cloud', 'react',
            'python', 'javascript', 'data scientist', 'devops'
        ]
        
        title_and_desc = f"{job.title} {job.description or ''}".lower()
        
        demand_score = sum(1 for keyword in high_demand_keywords if keyword in title_and_desc)
        
        if demand_score >= 3:
            analysis['market_demand'] = 'high'
        elif demand_score >= 1:
            analysis['market_demand'] = 'medium'
        else:
            analysis['market_demand'] = 'low'
        
        # Skill rarity (based on number of advanced skills)
        if enriched_fields.get('extracted_skills'):
            skills = enriched_fields['extracted_skills']
            rare_skills = ['rust', 'go', 'kubernetes', 'terraform', 'machine learning']
            
            rarity_score = 0
            for category, skill_list in skills.items():
                if isinstance(skill_list, list):
                    rarity_score += sum(1 for skill in skill_list if skill.lower() in rare_skills)
            
            analysis['skill_rarity_score'] = rarity_score
        
        return analysis
    
    def _calculate_confidence_score(self, enriched_fields: Dict[str, Any]) -> float:
        """Calculate confidence score for the enrichment."""
        
        field_weights = {
            'extracted_skills': 0.3,
            'normalized_salary': 0.25,
            'enriched_location': 0.2,
            'job_classification': 0.15,
            'market_analysis': 0.1
        }
        
        confidence = 0.0
        
        for field, weight in field_weights.items():
            if field in enriched_fields and enriched_fields[field]:
                confidence += weight
        
        return min(confidence * 100, 100.0)
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get processor statistics."""
        
        return {
            'jobs_processed': self.jobs_processed,
            'enrichment_errors': self.enrichment_errors,
            'success_rate': (
                (self.jobs_processed / (self.jobs_processed + self.enrichment_errors))
                if (self.jobs_processed + self.enrichment_errors) > 0 else 0
            )
        }


# Global instance
job_enrichment_processor = JobEnrichmentProcessor()
