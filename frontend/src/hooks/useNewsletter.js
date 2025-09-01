import { useState } from 'react';

export function useNewsletterPreferencesQuery() {
  const [data, setData] = useState({
    frequency: 'weekly',
    topics: ['jobs', 'tips'],
    subscribed: true
  });
  
  return {
    data,
    isLoading: false,
    error: null
  };
}

export function useUpdateNewsletterPreferencesMutation() {
  return {
    mutate: (preferences) => {
      console.log('Updating newsletter preferences:', preferences);
      return Promise.resolve();
    },
    isPending: false
  };
}
