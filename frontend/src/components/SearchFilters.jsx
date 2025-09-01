import React, { useState } from 'react';
import { Search, Filter, X, MapPin, DollarSign, Briefcase, Clock, Building, Tag } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Slider } from './ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';

const SearchFilters = ({ onFiltersChange, initialFilters = {} }) => {
  const [filters, setFilters] = useState({
    keywords: '',
    location: '',
    salaryMin: 0,
    salaryMax: 200000,
    experienceLevel: '',
    jobType: [],
    remote: false,
    companies: [],
    skills: [],
    datePosted: 'anytime',
    ...initialFilters
  });

  const [showAdvanced, setShowAdvanced] = useState(false);

  const jobTypes = ['Full-time', 'Part-time', 'Contract', 'Freelance', 'Internship'];
  const experienceLevels = ['Entry Level', 'Mid Level', 'Senior Level', 'Executive'];
  const datePostedOptions = [
    { value: 'anytime', label: 'Anytime' },
    { value: '24h', label: 'Past 24 hours' },
    { value: '3d', label: 'Past 3 days' },
    { value: '7d', label: 'Past week' },
    { value: '30d', label: 'Past month' }
  ];

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    if (onFiltersChange) {
      onFiltersChange(newFilters);
    }
  };

  const handleJobTypeToggle = (type) => {
    const newTypes = filters.jobType.includes(type)
      ? filters.jobType.filter(t => t !== type)
      : [...filters.jobType, type];
    handleFilterChange('jobType', newTypes);
  };

  const clearFilters = () => {
    const clearedFilters = {
      keywords: '',
      location: '',
      salaryMin: 0,
      salaryMax: 200000,
      experienceLevel: '',
      jobType: [],
      remote: false,
      companies: [],
      skills: [],
      datePosted: 'anytime'
    };
    setFilters(clearedFilters);
    if (onFiltersChange) {
      onFiltersChange(clearedFilters);
    }
  };

  const activeFiltersCount = Object.values(filters).filter(v => 
    v && (Array.isArray(v) ? v.length > 0 : v !== '' && v !== 0 && v !== false && v !== 'anytime')
  ).length;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Search Filters
          </CardTitle>
          {activeFiltersCount > 0 && (
            <div className="flex items-center gap-2">
              <Badge>{activeFiltersCount} active</Badge>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear all
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Basic Filters */}
        <div className="space-y-4">
          <div>
            <Label>Keywords</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Job title, skills, or company"
                value={filters.keywords}
                onChange={(e) => handleFilterChange('keywords', e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div>
            <Label>Location</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="City, state, or remote"
                value={filters.location}
                onChange={(e) => handleFilterChange('location', e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div>
            <Label>Salary Range</Label>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">${filters.salaryMin.toLocaleString()} - ${filters.salaryMax.toLocaleString()}</span>
              </div>
              <Slider
                min={0}
                max={200000}
                step={5000}
                value={[filters.salaryMin, filters.salaryMax]}
                onValueChange={([min, max]) => {
                  handleFilterChange('salaryMin', min);
                  handleFilterChange('salaryMax', max);
                }}
                className="w-full"
              />
            </div>
          </div>

          <div>
            <Label>Experience Level</Label>
            <Select value={filters.experienceLevel} onValueChange={(value) => handleFilterChange('experienceLevel', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select experience level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Levels</SelectItem>
                {experienceLevels.map(level => (
                  <SelectItem key={level} value={level}>{level}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Job Type</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {jobTypes.map(type => (
                <Badge
                  key={type}
                  variant={filters.jobType.includes(type) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => handleJobTypeToggle(type)}
                >
                  {filters.jobType.includes(type) && <Check className="h-3 w-3 mr-1" />}
                  {type}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="remote"
              checked={filters.remote}
              onCheckedChange={(checked) => handleFilterChange('remote', checked)}
            />
            <Label htmlFor="remote" className="cursor-pointer">
              Remote positions only
            </Label>
          </div>
        </div>

        {/* Advanced Filters */}
        <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full">
              {showAdvanced ? 'Hide' : 'Show'} Advanced Filters
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 mt-4">
            <div>
              <Label>Date Posted</Label>
              <Select value={filters.datePosted} onValueChange={(value) => handleFilterChange('datePosted', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {datePostedOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Companies</Label>
              <Input
                placeholder="Enter company names (comma separated)"
                value={filters.companies.join(', ')}
                onChange={(e) => handleFilterChange('companies', e.target.value.split(',').map(c => c.trim()).filter(Boolean))}
              />
            </div>

            <div>
              <Label>Required Skills</Label>
              <Input
                placeholder="Enter skills (comma separated)"
                value={filters.skills.join(', ')}
                onChange={(e) => handleFilterChange('skills', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
};

export default SearchFilters;
