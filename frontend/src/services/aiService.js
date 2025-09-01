// AI Services for Job Application Assistant
// This service handles all AI-powered features including text generation, analysis, and predictions

class AIService {
  constructor() {
    // Hugging Face is FREE with generous limits!
    this.huggingFaceKey = process.env.VITE_HUGGING_FACE_API_KEY || 'demo-key'
    this.huggingFaceUrl = 'https://api-inference.huggingface.co/models'
    // Using free models - no cost for first 30k tokens/month
    this.textModel = 'microsoft/DialoGPT-medium' // Free text generation
    this.embeddingModel = 'sentence-transformers/all-MiniLM-L6-v2' // Free embeddings
    
    // Alternative: Use completely FREE local models with Ollama
    this.useLocal = process.env.VITE_USE_LOCAL_AI === 'true'
    this.ollamaUrl = 'http://localhost:11434' // Ollama local server
  }

  async generateCoverLetter({ jobDescription, userProfile, companyInfo, jobTitle, companyName }) {
    // Simulate API call for demo - replace with actual OpenAI call
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    const prompt = `Write a professional cover letter for a ${jobTitle} position at ${companyName}.
    
Job Description: ${jobDescription}
User Profile: ${JSON.stringify(userProfile)}
Company Info: ${JSON.stringify(companyInfo)}

Make it personalized, highlighting relevant experience and showing enthusiasm for the role.`

    // Mock response for demo
    return {
      content: `Dear ${companyName} Hiring Team,

I am writing to express my strong interest in the ${jobTitle} position at ${companyName}. Having researched your company's innovative approach to ${companyInfo?.industry || 'technology'}, I am excited about the opportunity to contribute to your team's continued success.

With my background in ${userProfile?.skills?.[0] || 'software development'}, I am particularly drawn to this role because it aligns perfectly with my passion for ${userProfile?.interests || 'creating impactful solutions'}. In my previous experience, I have successfully ${this.generateRelevantExperience(jobDescription, userProfile)}.

What excites me most about ${companyName} is ${this.generateCompanySpecificReason(companyInfo)}. I am confident that my skills in ${userProfile?.topSkills?.join(', ') || 'problem-solving and communication'} would make me a valuable addition to your team.

I would welcome the opportunity to discuss how my experience and enthusiasm can contribute to ${companyName}'s continued growth. Thank you for considering my application.

Best regards,
${userProfile?.name || 'Your Name'}`,
      suggestions: [
        {
          type: 'tone',
          current: 'professional',
          alternatives: ['enthusiastic', 'formal', 'conversational']
        },
        {
          type: 'length',
          current: 'standard',
          alternatives: ['concise', 'detailed']
        }
      ],
      matchScore: Math.floor(Math.random() * 20 + 80) // 80-100%
    }
  }

  async optimizeCV({ currentCV, jobDescription, targetRole }) {
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    // Analyze job description for keywords
    const jobKeywords = this.extractKeywords(jobDescription)
    const cvKeywords = this.extractKeywords(currentCV)
    
    const missingKeywords = jobKeywords.filter(keyword => 
      !cvKeywords.some(cvKeyword => 
        cvKeyword.toLowerCase().includes(keyword.toLowerCase())
      )
    )

    const suggestions = missingKeywords.slice(0, 8).map(keyword => ({
      keyword,
      section: this.suggestCVSection(keyword),
      importance: Math.random() > 0.5 ? 'high' : 'medium',
      suggestion: this.generateKeywordSuggestion(keyword, targetRole),
      originalText: this.findRelevantCVSection(currentCV, keyword),
      suggestedText: this.generateImprovedText(currentCV, keyword, targetRole)
    }))

    return {
      overallScore: Math.floor(Math.random() * 15 + 75), // 75-90%
      missingKeywords: missingKeywords.slice(0, 5),
      suggestions,
      strengthAreas: this.identifyStrengths(currentCV, jobDescription),
      improvementAreas: this.identifyImprovements(currentCV, jobDescription),
      atsCompatibility: Math.floor(Math.random() * 10 + 85) // 85-95%
    }
  }

  async predictApplicationSuccess({ jobDescription, userProfile, applicationHistory, companyInfo }) {
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Calculate success probability based on various factors
    const baseScore = 0.3 // Base probability
    
    // Factor in user's experience level
    const experienceMultiplier = this.calculateExperienceMatch(userProfile, jobDescription)
    
    // Factor in application history
    const historyMultiplier = this.calculateHistorySuccess(applicationHistory)
    
    // Factor in company match
    const companyMultiplier = this.calculateCompanyMatch(userProfile, companyInfo)
    
    const successProbability = Math.min(0.95, baseScore + experienceMultiplier + historyMultiplier + companyMultiplier)
    
    return {
      successProbability: Math.round(successProbability * 100),
      confidenceLevel: successProbability > 0.7 ? 'high' : successProbability > 0.4 ? 'medium' : 'low',
      keyFactors: [
        {
          factor: 'Experience Match',
          impact: experienceMultiplier > 0.2 ? 'positive' : 'neutral',
          description: this.getExperienceMatchDescription(experienceMultiplier)
        },
        {
          factor: 'Application History',
          impact: historyMultiplier > 0.1 ? 'positive' : 'neutral',
          description: this.getHistoryDescription(applicationHistory)
        },
        {
          factor: 'Company Culture Fit',
          impact: companyMultiplier > 0.15 ? 'positive' : 'neutral',
          description: this.getCultureFitDescription(companyMultiplier)
        }
      ],
      recommendations: this.generateSuccessRecommendations(successProbability, userProfile, jobDescription),
      timelinePrediction: this.predictResponseTimeline(companyInfo, successProbability)
    }
  }

  async analyzeCompanyIntelligence(companyName) {
    await new Promise(resolve => setTimeout(resolve, 1200))
    
    // Mock company intelligence - in production, integrate with company APIs, news sources, etc.
    const mockIntelligence = {
      basicInfo: {
        name: companyName,
        industry: this.getRandomIndustry(),
        size: this.getRandomCompanySize(),
        founded: Math.floor(Math.random() * 30 + 1990),
        headquarters: this.getRandomLocation(),
        website: `https://${companyName.toLowerCase().replace(/\s+/g, '')}.com`
      },
      culture: {
        values: this.getRandomValues(),
        workStyle: this.getRandomWorkStyle(),
        benefits: this.getRandomBenefits(),
        rating: (Math.random() * 2 + 3).toFixed(1) // 3.0-5.0
      },
      recentNews: [
        {
          title: `${companyName} announces expansion plans`,
          date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
          summary: `${companyName} is expanding operations and looking to hire top talent.`,
          source: 'Tech News'
        },
        {
          title: `${companyName} wins industry award`,
          date: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000).toISOString(),
          summary: `Recognition for innovation in their field.`,
          source: 'Business Journal'
        }
      ],
      hiringTrends: {
        averageHiringTime: Math.floor(Math.random() * 20 + 10) + ' days',
        responseRate: Math.floor(Math.random() * 30 + 60) + '%',
        commonRequirements: this.getCommonRequirements(),
        popularRoles: this.getPopularRoles()
      },
      insights: {
        bestTimeToApply: this.getBestApplicationTime(),
        keywordsTips: this.getKeywordTips(companyName),
        cultureMatchTips: this.getCultureMatchTips()
      }
    }

    return mockIntelligence
  }

  async performAdvancedMatching({ userProfile, jobListing, preferences }) {
    await new Promise(resolve => setTimeout(resolve, 800))
    
    const technicalMatch = this.calculateTechnicalMatch(userProfile.skills, jobListing.requirements)
    const cultureMatch = this.calculateCultureMatch(userProfile.workStyle, jobListing.culture)
    const locationMatch = this.calculateLocationMatch(preferences.location, jobListing.location)
    const salaryMatch = this.calculateSalaryMatch(preferences.salary, jobListing.salary)
    const personalityMatch = this.calculatePersonalityMatch(userProfile.personality, jobListing.teamStyle)
    
    const overallMatch = (technicalMatch + cultureMatch + locationMatch + salaryMatch + personalityMatch) / 5

    return {
      overallMatchScore: Math.round(overallMatch),
      breakdown: {
        technical: Math.round(technicalMatch),
        culture: Math.round(cultureMatch),
        location: Math.round(locationMatch),
        salary: Math.round(salaryMatch),
        personality: Math.round(personalityMatch)
      },
      explanation: {
        strengths: this.getMatchStrengths(overallMatch, { technicalMatch, cultureMatch, locationMatch }),
        concerns: this.getMatchConcerns(overallMatch, { technicalMatch, cultureMatch, locationMatch }),
        recommendations: this.getMatchRecommendations(userProfile, jobListing)
      },
      confidence: overallMatch > 80 ? 'high' : overallMatch > 60 ? 'medium' : 'low'
    }
  }

  // Helper methods for AI calculations
  extractKeywords(text) {
    const commonKeywords = [
      'JavaScript', 'Python', 'React', 'Node.js', 'SQL', 'AWS', 'Docker', 'Git',
      'Agile', 'Scrum', 'Leadership', 'Communication', 'Problem Solving',
      'Project Management', 'Data Analysis', 'Machine Learning', 'DevOps'
    ]
    
    return commonKeywords.filter(keyword => 
      text.toLowerCase().includes(keyword.toLowerCase())
    )
  }

  suggestCVSection(keyword) {
    const sections = ['Professional Summary', 'Technical Skills', 'Work Experience', 'Projects']
    return sections[Math.floor(Math.random() * sections.length)]
  }

  generateKeywordSuggestion(keyword, targetRole) {
    return `Consider highlighting your experience with ${keyword} to better match the ${targetRole} requirements.`
  }

  findRelevantCVSection(cv, keyword) {
    return `Experience with ${keyword} in previous projects`
  }

  generateImprovedText(cv, keyword, targetRole) {
    return `Extensive experience with ${keyword}, successfully implementing solutions in ${targetRole} context with measurable results.`
  }

  calculateExperienceMatch(profile, jobDescription) {
    return Math.random() * 0.3 // 0-0.3 multiplier
  }

  calculateHistorySuccess(history) {
    if (!history || history.length === 0) return 0.1
    const successRate = history.filter(app => ['hired', 'offer'].includes(app.status)).length / history.length
    return successRate * 0.2
  }

  calculateCompanyMatch(profile, company) {
    return Math.random() * 0.25 // 0-0.25 multiplier
  }

  // Mock data generators
  getRandomIndustry() {
    const industries = ['Technology', 'Finance', 'Healthcare', 'Education', 'Manufacturing', 'Retail']
    return industries[Math.floor(Math.random() * industries.length)]
  }

  getRandomCompanySize() {
    const sizes = ['1-10', '11-50', '51-200', '201-1000', '1000+']
    return sizes[Math.floor(Math.random() * sizes.length)] + ' employees'
  }

  getRandomLocation() {
    const locations = ['Cape Town, SA', 'Johannesburg, SA', 'Durban, SA', 'Pretoria, SA', 'Port Elizabeth, SA']
    return locations[Math.floor(Math.random() * locations.length)]
  }

  getRandomValues() {
    const allValues = ['Innovation', 'Collaboration', 'Integrity', 'Excellence', 'Customer Focus', 'Growth Mindset']
    return allValues.sort(() => 0.5 - Math.random()).slice(0, 3)
  }

  getRandomWorkStyle() {
    const styles = ['Remote-first', 'Hybrid', 'In-office', 'Flexible hours', 'Traditional hours']
    return styles[Math.floor(Math.random() * styles.length)]
  }

  getRandomBenefits() {
    const allBenefits = ['Health Insurance', 'Retirement Plan', 'Flexible PTO', 'Professional Development', 'Remote Work', 'Gym Membership']
    return allBenefits.sort(() => 0.5 - Math.random()).slice(0, 4)
  }

  calculateTechnicalMatch(userSkills, jobRequirements) {
    return Math.random() * 40 + 50 // 50-90%
  }

  calculateCultureMatch(userStyle, jobCulture) {
    return Math.random() * 40 + 40 // 40-80%
  }

  calculateLocationMatch(userLocation, jobLocation) {
    return Math.random() * 30 + 60 // 60-90%
  }

  calculateSalaryMatch(userExpectation, jobOffer) {
    return Math.random() * 25 + 70 // 70-95%
  }

  calculatePersonalityMatch(userPersonality, teamStyle) {
    return Math.random() * 35 + 45 // 45-80%
  }

  // Additional helper methods would continue here...
  generateRelevantExperience(jobDescription, userProfile) {
    return "delivered high-impact solutions that improved team productivity by 25%"
  }

  generateCompanySpecificReason(companyInfo) {
    return `your commitment to ${companyInfo?.values?.[0] || 'innovation'} and fostering a collaborative work environment`
  }

  identifyStrengths(cv, jobDescription) {
    return ['Strong technical background', 'Leadership experience', 'Problem-solving skills']
  }

  identifyImprovements(cv, jobDescription) {
    return ['Add more quantified achievements', 'Include recent certifications', 'Highlight team collaboration']
  }

  getExperienceMatchDescription(multiplier) {
    return multiplier > 0.2 ? 'Strong alignment with role requirements' : 'Some relevant experience, room for growth'
  }

  getHistoryDescription(history) {
    return 'Consistent application quality with positive response trends'
  }

  getCultureFitDescription(multiplier) {
    return multiplier > 0.15 ? 'Excellent cultural alignment indicators' : 'Good potential for cultural fit'
  }

  generateSuccessRecommendations(probability, profile, jobDescription) {
    return [
      'Tailor your application to highlight matching keywords',
      'Research the company culture thoroughly',
      'Prepare specific examples that demonstrate required skills'
    ]
  }

  predictResponseTimeline(companyInfo, successProbability) {
    const baseDays = Math.floor(Math.random() * 14 + 7) // 7-21 days
    return {
      estimatedResponse: baseDays + ' days',
      confidence: successProbability > 0.7 ? 'high' : 'medium',
      factors: ['Company size', 'Industry hiring patterns', 'Role level']
    }
  }

  getCommonRequirements() {
    return ['3+ years experience', 'Bachelor\'s degree', 'Strong communication skills']
  }

  getPopularRoles() {
    return ['Software Developer', 'Project Manager', 'Data Analyst', 'UX Designer']
  }

  getBestApplicationTime() {
    return 'Tuesday-Thursday, 9-11 AM for highest response rates'
  }

  getKeywordTips(companyName) {
    return `Focus on keywords related to ${companyName}'s core technologies and values`
  }

  getCultureMatchTips() {
    return 'Demonstrate alignment with company values through specific examples'
  }

  getMatchStrengths(overallMatch, breakdown) {
    const strengths = []
    if (breakdown.technicalMatch > 80) strengths.push('Excellent technical skill alignment')
    if (breakdown.cultureMatch > 75) strengths.push('Strong cultural fit indicators')
    if (breakdown.locationMatch > 85) strengths.push('Perfect location match')
    return strengths.length > 0 ? strengths : ['Good overall compatibility']
  }

  getMatchConcerns(overallMatch, breakdown) {
    const concerns = []
    if (breakdown.technicalMatch < 60) concerns.push('Some technical skills gaps')
    if (breakdown.cultureMatch < 50) concerns.push('Potential cultural misalignment')
    return concerns
  }

  getMatchRecommendations(profile, jobListing) {
    return [
      'Highlight transferable skills in your application',
      'Research the company\'s recent projects and initiatives',
      'Consider reaching out to current employees for insights'
    ]
  }
}

export default new AIService()
