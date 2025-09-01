import React, { useState } from 'react';
import { HelpCircle, MessageSquare, Book, Mail, Search } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';

export default function Support() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const faqs = [
    { q: 'How do I upgrade my plan?', a: 'Go to Settings > Subscription and select your new plan.' },
    { q: 'Can I cancel anytime?', a: 'Yes, you can cancel your subscription anytime from Settings.' },
    { q: 'How does the AI matching work?', a: 'Our AI analyzes your profile and matches you with relevant jobs.' },
    { q: 'What payment methods do you accept?', a: 'We accept all major credit cards and PayPal.' }
  ];

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-3xl md:text-5xl font-bold text-white mb-6">Support Center</h1>
        
        <div className="mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search for help..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6 text-center">
              <Book className="h-12 w-12 mx-auto mb-4 text-cyan-400" />
              <h3 className="font-semibold mb-2">Documentation</h3>
              <p className="text-sm text-gray-400">Browse our guides and tutorials</p>
              <Button className="mt-4" variant="outline">View Docs</Button>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6 text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 text-cyan-400" />
              <h3 className="font-semibold mb-2">Live Chat</h3>
              <p className="text-sm text-gray-400">Chat with our support team</p>
              <Button className="mt-4">Start Chat</Button>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6 text-center">
              <Mail className="h-12 w-12 mx-auto mb-4 text-cyan-400" />
              <h3 className="font-semibold mb-2">Email Support</h3>
              <p className="text-sm text-gray-400">Get help via email</p>
              <Button className="mt-4" variant="outline">Send Email</Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Frequently Asked Questions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {faqs.map((faq, i) => (
                <div key={i} className="border-b pb-4">
                  <h4 className="font-semibold mb-2">{faq.q}</h4>
                  <p className="text-gray-400">{faq.a}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
