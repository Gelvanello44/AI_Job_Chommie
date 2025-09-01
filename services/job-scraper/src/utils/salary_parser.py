"""
Salary parsing utilities for job scraping and data extraction.
"""

import re
from typing import Dict, Optional, Tuple, Any


class SalaryParser:
    """Salary parsing utilities for extracting and normalizing salary information."""
    
    def __init__(self):
        # South African Rand patterns
        self.zar_patterns = [
            r'R\s*(\d{1,3}(?:[,\s]\d{3})*(?:\.\d{2})?)\s*-?\s*R?\s*(\d{1,3}(?:[,\s]\d{3})*(?:\.\d{2})?)?',
            r'(\d{1,3}(?:[,\s]\d{3})*)\s*-?\s*(\d{1,3}(?:[,\s]\d{3})*)?(?:\s*rand|ZAR|R)',
            r'salary:\s*R?(\d{1,3}(?:[,\s]\d{3})*(?:\.\d{2})?)',
            r'R(\d+k?)\s*-?\s*R?(\d+k?)?',
        ]
        
        # Time periods
        self.period_patterns = {
            'hour': ['hour', 'hourly', 'hr', '/hour'],
            'day': ['day', 'daily', '/day'],
            'week': ['week', 'weekly', '/week', 'wk'],
            'month': ['month', 'monthly', '/month', 'per month', 'pm'],
            'year': ['year', 'yearly', 'annual', 'annually', '/year', 'pa', 'per annum']
        }
        
        # Salary qualifiers
        self.qualifier_patterns = {
            'negotiable': ['negotiable', 'neg', 'market related'],
            'competitive': ['competitive', 'market competitive'],
            'excellent': ['excellent', 'attractive'],
            'plus_benefits': ['plus benefits', '+ benefits', 'benefits included']
        }
    
    def parse(self, salary_text: str) -> Dict[str, Any]:
        """Parse salary text and return structured salary information."""
        if not salary_text:
            return {}
        
        salary_text = salary_text.strip().lower()
        
        result = {
            'raw_text': salary_text,
            'currency': 'ZAR',
            'country': 'South Africa'
        }
        
        # Check for qualifiers first
        qualifiers = self._extract_qualifiers(salary_text)
        if qualifiers:
            result['qualifiers'] = qualifiers
        
        # Extract numeric salary values
        min_salary, max_salary = self._extract_salary_range(salary_text)
        
        if min_salary is not None:
            result['min_salary'] = min_salary
            result['salary_min'] = min_salary  # Alternative key name
            
        if max_salary is not None:
            result['max_salary'] = max_salary
            result['salary_max'] = max_salary  # Alternative key name
            
        # If only one salary found, use it as both min and max
        if min_salary is not None and max_salary is None:
            result['max_salary'] = min_salary
            result['salary_max'] = min_salary
        
        # Extract time period
        period = self._extract_period(salary_text)
        if period:
            result['period'] = period
            result['salary_period'] = period  # Alternative key name
        
        # Generate formatted salary string
        formatted = self._format_salary(result)
        if formatted:
            result['formatted'] = formatted
            result['salary_formatted'] = formatted  # Alternative key name
        
        # Calculate annual salary if possible
        annual_min, annual_max = self._calculate_annual_salary(
            min_salary, max_salary, period
        )
        
        if annual_min is not None:
            result['annual_min'] = annual_min
        if annual_max is not None:
            result['annual_max'] = annual_max
        
        return result
    
    def _extract_salary_range(self, text: str) -> Tuple[Optional[float], Optional[float]]:
        """Extract salary range from text."""
        for pattern in self.zar_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                groups = match.groups()
                
                # Clean and convert first number
                min_val = self._clean_and_convert_number(groups[0])
                
                # Check for second number (max)
                max_val = None
                if len(groups) > 1 and groups[1]:
                    max_val = self._clean_and_convert_number(groups[1])
                
                return min_val, max_val
        
        # Try to extract single numbers
        single_pattern = r'(\d{1,3}(?:[,\s]\d{3})+|\d+k)'
        matches = re.findall(single_pattern, text, re.IGNORECASE)
        
        if matches:
            numbers = [self._clean_and_convert_number(match) for match in matches]
            numbers = [n for n in numbers if n is not None]
            
            if len(numbers) == 1:
                return numbers[0], None
            elif len(numbers) >= 2:
                return min(numbers), max(numbers)
        
        return None, None
    
    def _clean_and_convert_number(self, num_str: str) -> Optional[float]:
        """Clean and convert number string to float."""
        if not num_str:
            return None
        
        # Remove spaces and common separators
        cleaned = re.sub(r'[,\s]', '', num_str.strip())
        
        # Handle 'k' suffix (thousands)
        if cleaned.lower().endswith('k'):
            try:
                base_num = float(cleaned[:-1])
                return base_num * 1000
            except ValueError:
                return None
        
        # Convert to float
        try:
            return float(cleaned)
        except ValueError:
            return None
    
    def _extract_period(self, text: str) -> Optional[str]:
        """Extract salary time period from text."""
        for period, keywords in self.period_patterns.items():
            for keyword in keywords:
                if keyword in text:
                    return period
        
        # Default to annual for high values (likely annual salaries)
        numbers = re.findall(r'\d+', text.replace(',', ''))
        if numbers:
            max_num = max(int(n) for n in numbers)
            if max_num > 50000:  # Likely annual if > R50k
                return 'year'
            elif max_num < 1000:  # Likely hourly if < R1k
                return 'hour'
        
        return 'month'  # Default assumption
    
    def _extract_qualifiers(self, text: str) -> list:
        """Extract salary qualifiers like 'negotiable', 'competitive'."""
        qualifiers = []
        
        for qualifier, keywords in self.qualifier_patterns.items():
            for keyword in keywords:
                if keyword in text:
                    qualifiers.append(qualifier)
                    break
        
        return list(set(qualifiers))  # Remove duplicates
    
    def _format_salary(self, salary_data: Dict[str, Any]) -> str:
        """Format salary data into a readable string."""
        min_sal = salary_data.get('min_salary')
        max_sal = salary_data.get('max_salary')
        period = salary_data.get('period', 'month')
        currency = salary_data.get('currency', 'ZAR')
        
        if min_sal is None and max_sal is None:
            return ""
        
        # Format numbers with appropriate separators
        def format_number(num):
            if num >= 1000000:
                return f"{num/1000000:.1f}M"
            elif num >= 1000:
                return f"{num/1000:.0f}K"
            else:
                return f"{num:,.0f}"
        
        # Build formatted string
        if currency == 'ZAR':
            prefix = "R"
        else:
            prefix = f"{currency} "
        
        if min_sal is not None and max_sal is not None and min_sal != max_sal:
            formatted = f"{prefix}{format_number(min_sal)} - {prefix}{format_number(max_sal)}"
        elif min_sal is not None:
            formatted = f"{prefix}{format_number(min_sal)}"
        else:
            formatted = f"{prefix}{format_number(max_sal)}"
        
        # Add period
        period_suffix = {
            'hour': ' per hour',
            'day': ' per day', 
            'week': ' per week',
            'month': ' per month',
            'year': ' per year'
        }
        
        if period in period_suffix:
            formatted += period_suffix[period]
        
        # Add qualifiers
        qualifiers = salary_data.get('qualifiers', [])
        if qualifiers:
            formatted += f" ({', '.join(qualifiers)})"
        
        return formatted
    
    def _calculate_annual_salary(self, min_sal: Optional[float], max_sal: Optional[float], 
                                period: Optional[str]) -> Tuple[Optional[float], Optional[float]]:
        """Calculate annual salary equivalents."""
        if not period:
            return None, None
        
        # Conversion factors to annual
        conversion_factors = {
            'hour': 2080,  # 40 hours * 52 weeks
            'day': 260,    # ~22 days * 12 months
            'week': 52,    # 52 weeks
            'month': 12,   # 12 months
            'year': 1      # Already annual
        }
        
        factor = conversion_factors.get(period, 1)
        
        annual_min = min_sal * factor if min_sal is not None else None
        annual_max = max_sal * factor if max_sal is not None else None
        
        return annual_min, annual_max
    
    def is_competitive_salary(self, salary_data: Dict[str, Any], job_level: str = 'mid') -> bool:
        """Determine if salary is competitive for South African market."""
        annual_min = salary_data.get('annual_min')
        if annual_min is None:
            return False
        
        # South African salary benchmarks (rough estimates in ZAR)
        benchmarks = {
            'entry': {'min': 200000, 'good': 300000},
            'mid': {'min': 400000, 'good': 600000},
            'senior': {'min': 700000, 'good': 1000000},
            'manager': {'min': 800000, 'good': 1200000},
            'director': {'min': 1200000, 'good': 2000000},
            'executive': {'min': 1500000, 'good': 3000000}
        }
        
        if job_level not in benchmarks:
            job_level = 'mid'
        
        benchmark = benchmarks[job_level]
        return annual_min >= benchmark['good']
