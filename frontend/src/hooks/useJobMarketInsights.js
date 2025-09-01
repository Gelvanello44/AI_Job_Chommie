import { useState } from 'react';

export function useJobMarketInsightsQuery() {
  const [data, setData] = useState({
    trends: {
      topRoles: ['Software Developer', 'Data Scientist', 'Product Manager'],
      growthRate: 15,
      avgSalary: 75000
    },
    insights: [
      { title: 'Remote work growing', percentage: 45 },
      { title: 'AI skills in demand', percentage: 68 }
    ]
  });
  
  return {
    data,
    isLoading: false,
    error: null
  };
}
