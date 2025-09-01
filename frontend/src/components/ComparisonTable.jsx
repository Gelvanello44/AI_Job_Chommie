import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';

const ComparisonTable = ({ jobs = [], onRemove }) => {
  const [weights, setWeights] = useState({
    salary: 0.3,
    benefits: 0.2,
    location: 0.2,
    culture: 0.15,
    growth: 0.15
  });

  const calculateScore = (job) => {
    return (
      (job.salary / 100000) * weights.salary * 100 +
      (job.benefitsScore || 0) * weights.benefits +
      (job.locationScore || 0) * weights.location +
      (job.cultureScore || 0) * weights.culture +
      (job.growthScore || 0) * weights.growth
    ).toFixed(1);
  };

  const comparisonCriteria = [
    'Company', 'Position', 'Salary', 'Location', 'Remote', 'Benefits',
    'Interview Process', 'Team Size', 'Tech Stack', 'Growth Opportunity',
    'Work-Life Balance', 'Overall Score'
  ];

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Job Comparison</CardTitle>
      </CardHeader>
      <CardContent>
        {jobs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Add jobs to compare them side by side
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Criteria</th>
                  {jobs.map((job) => (
                    <th key={job.id} className="text-left p-2 min-w-[200px]">
                      <div className="flex justify-between items-start">
                        <span>{job.company}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => onRemove(job.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonCriteria.map((criteria) => (
                  <tr key={criteria} className="border-b">
                    <td className="font-medium p-2">
                      {criteria}
                    </td>
                    {jobs.map((job) => (
                      <td key={job.id} className="p-2">
                        {criteria === 'Overall Score' ? (
                          <Badge variant="default">{calculateScore(job)}</Badge>
                        ) : criteria === 'Remote' ? (
                          job.remote ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-red-500" />
                        ) : (
                          job[criteria.toLowerCase().replace(/\s+/g, '')] || '-'
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ComparisonTable;
