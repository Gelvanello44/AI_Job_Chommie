import { PrismaClient } from '@prisma/client';
import { AppError } from '../utils/AppError.js';
import logger from '../config/logger.js';
import { config } from '../config/index.js';
import multilingualService, { SALanguage } from './multilingual.service.js';

interface VoiceCommand {
  type: 'search' | 'apply' | 'navigate' | 'help' | 'settings';
  content: string;
  language: SALanguage;
  confidence: number;
}

interface VoiceResponse {
  text: string;
  audioUrl?: string;
  language: SALanguage;
  followUpActions?: string[];
}

// Voice command patterns for different languages
const VOICE_COMMANDS = {
  'en': {
    search: ['find jobs', 'search for', 'look for work', 'find work', 'job search'],
    apply: ['apply for job', 'submit application', 'apply now', 'send application'],
    navigate: ['go to', 'open', 'show me', 'take me to'],
    help: ['help me', 'how do I', 'what can you do', 'assist me'],
    settings: ['change language', 'settings', 'preferences', 'my profile']
  },
  'af': {
    search: ['soek werk', 'vind werk', 'kry werk', 'werk soek'],
    apply: ['aansoek doen', 'stuur aansoek', 'solliciteer'],
    navigate: ['gaan na', 'wys my', 'open'],
    help: ['help my', 'hoe doen ek', 'wat kan jy doen'],
    settings: ['verander taal', 'instellings', 'my profiel']
  },
  'zu': {
    search: ['sesha umsebenzi', 'thola umsebenzi', 'funa umsebenzi'],
    apply: ['faka isicelo', 'thumela isicelo'],
    navigate: ['iya ku', 'bonisa', 'vula'],
    help: ['ngisize', 'ngingakwenza kanjani', 'ungakwenzani'],
    settings: ['shintsha ulimi', 'izilungiselelo']
  },
  'xh': {
    search: ['khangela umsebenzi', 'fumana umsebenzi', 'funa umsebenzi'],
    apply: ['faka isicelo', 'thumela isicelo'],
    navigate: ['yiya ku', 'bonisa', 'vula'],
    help: ['ndicede', 'ndingayenza njani', 'unokwenza ntoni'],
    settings: ['tshintsha ulwimi', 'iisethingi']
  }
};

// Common voice navigation commands
const NAVIGATION_COMMANDS = {
  'en': {
    'dashboard': ['home', 'main page', 'dashboard'],
    'jobs': ['jobs', 'job listings', 'find jobs'],
    'applications': ['my applications', 'applications', 'job applications'],
    'profile': ['my profile', 'profile', 'account'],
    'cv': ['my cv', 'resume', 'curriculum vitae'],
    'settings': ['settings', 'preferences', 'account settings']
  },
  'af': {
    'dashboard': ['tuis', 'hoofbladsy', 'dashboard'],
    'jobs': ['werk', 'werksgeleenthede'],
    'applications': ['my aansoeke', 'aansoeke'],
    'profile': ['my profiel', 'profiel', 'rekening'],
    'cv': ['my cv', 'curriculum vitae'],
    'settings': ['instellings', 'voorkeure']
  },
  'zu': {
    'dashboard': ['ekhaya', 'ikhasi eliyinhloko'],
    'jobs': ['imisebenzi', 'amathuba omsebenzi'],
    'applications': ['izicelo zami', 'izicelo'],
    'profile': ['iphrofayela yami', 'i-akhawunti'],
    'cv': ['i-cv yami', 'i-resume'],
    'settings': ['izilungiselelo', 'okukhethwayo']
  },
  'xh': {
    'dashboard': ['ekhaya', 'iphepha eliphambili'],
    'jobs': ['imisebenzi', 'amathuba omsebenzi'],
    'applications': ['izicelo zam', 'izicelo'],
    'profile': ['iprofayile yam', 'iakhawunti'],
    'cv': ['i-cv yam', 'i-resume'],
    'settings': ['iisethingi', 'ezikhethwayo']
  }
};

export class VoiceOperationService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Process speech-to-text conversion
   */
  async speechToText(audioData: Buffer, language: SALanguage = SALanguage.ENGLISH): Promise<string> {
    try {
      // In production, integrate with speech recognition service
      // This is a placeholder implementation
      
      logger.info('Processing speech-to-text', { language, dataSize: audioData.length });
      
      // TODO: Integrate with Azure Speech Services, Google Speech-to-Text, or similar
      // that supports South African languages and accents
      
      // For now, return placeholder text
      return 'Transcribed text would appear here';
      
    } catch (error) {
      logger.error('Speech-to-text conversion failed', { error, language });
      throw new AppError('Failed to process speech', 500);
    }
  }

  /**
   * Process text-to-speech conversion
   */
  async textToSpeech(text: string, language: SALanguage = SALanguage.ENGLISH): Promise<Buffer> {
    try {
      logger.info('Processing text-to-speech', { language, textLength: text.length });
      
      // TODO: Integrate with text-to-speech service that supports SA languages
      // Azure Cognitive Services Speech or Google Text-to-Speech
      
      // Return placeholder audio buffer
      return Buffer.from('placeholder audio data');
      
    } catch (error) {
      logger.error('Text-to-speech conversion failed', { error, language });
      throw new AppError('Failed to generate speech', 500);
    }
  }

  /**
   * Process voice command and return appropriate response
   */
  async processVoiceCommand(audioData: Buffer, userId: string): Promise<VoiceResponse> {
    try {
      // Get user's preferred language
      const userLanguage = await multilingualService.getUserLanguage(userId);
      
      // Convert speech to text
      const transcribedText = await this.speechToText(audioData, userLanguage);
      
      // Parse the command
      const command = this.parseVoiceCommand(transcribedText, userLanguage);
      
      // Execute the command
      const response = await this.executeVoiceCommand(command, userId);
      
      // Convert response to speech
      const audioBuffer = await this.textToSpeech(response.text, userLanguage);
      
      return {
        ...response,
        audioUrl: await this.saveAudioResponse(audioBuffer, userId)
      };
      
    } catch (error) {
      logger.error('Voice command processing failed', { error, userId });
      
      // Return error message in user's language
      const userLanguage = await multilingualService.getUserLanguage(userId);
      const errorMessage = await this.getErrorMessage(userLanguage);
      
      return {
        text: errorMessage,
        language: userLanguage,
        followUpActions: ['try_again', 'type_instead']
      };
    }
  }

  /**
   * Parse voice command to understand intent
   */
  private parseVoiceCommand(text: string, language: SALanguage): VoiceCommand {
    const lowerText = text.toLowerCase();
    const commands = VOICE_COMMANDS[language] || VOICE_COMMANDS['en'];
    
    let commandType: VoiceCommand['type'] = 'help';
    let confidence = 0.5;
    
    // Check for search commands
    if (commands.search?.some(pattern => lowerText.includes(pattern))) {
      commandType = 'search';
      confidence = 0.8;
    }
    // Check for application commands
    else if (commands.apply?.some(pattern => lowerText.includes(pattern))) {
      commandType = 'apply';
      confidence = 0.8;
    }
    // Check for navigation commands
    else if (commands.navigate?.some(pattern => lowerText.includes(pattern))) {
      commandType = 'navigate';
      confidence = 0.8;
    }
    // Check for settings commands
    else if (commands.settings?.some(pattern => lowerText.includes(pattern))) {
      commandType = 'settings';
      confidence = 0.8;
    }
    
    return {
      type: commandType,
      content: text,
      language,
      confidence
    };
  }

  /**
   * Execute parsed voice command
   */
  private async executeVoiceCommand(command: VoiceCommand, userId: string): Promise<VoiceResponse> {
    const language = command.language;
    
    switch (command.type) {
      case 'search':
        return await this.handleSearchCommand(command, userId);
      
      case 'apply':
        return await this.handleApplyCommand(command, userId);
      
      case 'navigate':
        return await this.handleNavigationCommand(command, userId);
      
      case 'settings':
        return await this.handleSettingsCommand(command, userId);
      
      default:
        return await this.handleHelpCommand(command, userId);
    }
  }

  /**
   * Handle job search voice command
   */
  private async handleSearchCommand(command: VoiceCommand, userId: string): Promise<VoiceResponse> {
    try {
      // Extract job search query from voice command
      const searchQuery = this.extractSearchQuery(command.content, command.language);
      
      // Perform job search
      const jobs = await multilingualService.searchJobsInLanguage(searchQuery, userId);
      
      // Format response
      const jobCount = jobs.length;
      const responseText = await this.formatSearchResponse(jobCount, command.language);
      
      return {
        text: responseText,
        language: command.language,
        followUpActions: jobCount > 0 ? ['view_jobs', 'refine_search'] : ['try_different_search']
      };
      
    } catch (error) {
      logger.error('Search command failed', { error, command });
      return await this.getErrorResponse(command.language);
    }
  }

  /**
   * Handle job application voice command
   */
  private async handleApplyCommand(command: VoiceCommand, userId: string): Promise<VoiceResponse> {
    try {
      // In a real implementation, this would guide the user through application process
      const responseMessages = {
        'en': 'To apply for a job, first search for positions that interest you. I can help you find suitable jobs based on your skills and preferences.',
        'af': 'Om vir werk aan te soek, soek eers posisies wat jou interesseer. Ek kan jou help om geskikte werk te vind gebaseer op jou vaardighede.',
        'zu': 'Ukufaka isicelo somsebenzi, qala ngokusesha izikhundla ezikuthakazelisa. Ngingakusiza ukuthola umsebenzi ofanelekile ngokuya ngamakhono akho.',
        'xh': 'Ukufaka isicelo lomsebenzi, qala ngokukhangela izikhundla ezikunomdla. Ndingakunceda ukufumana umsebenzi ofanelekileyo ngokweesakhono zakho.'
      };
      
      return {
        text: responseMessages[command.language] || responseMessages['en'],
        language: command.language,
        followUpActions: ['search_jobs', 'view_profile', 'upload_cv']
      };
      
    } catch (error) {
      logger.error('Apply command failed', { error, command });
      return await this.getErrorResponse(command.language);
    }
  }

  /**
   * Handle navigation voice command
   */
  private async handleNavigationCommand(command: VoiceCommand, userId: string): Promise<VoiceResponse> {
    try {
      const destination = this.extractNavigationDestination(command.content, command.language);
      
      const responseMessages = {
        'en': `Taking you to ${destination}. You can navigate using voice commands or by touching the screen.`,
        'af': `Neem jou na ${destination}. Jy kan navigeer deur stem opdragte of deur die skerm te raak.`,
        'zu': `Ngikusa ku-${destination}. Ungakwazi ukuzulazula usebenzisa imiyalo yezwi noma ngokuthinta isikrini.`,
        'xh': `Ndikusa ku-${destination}. Ungakwazi ukuhamba usebenzisa imiyalelo yezwi okanye ngokuchukumisa isikrini.`
      };
      
      return {
        text: responseMessages[command.language] || responseMessages['en'],
        language: command.language,
        followUpActions: ['navigate_to_' + destination]
      };
      
    } catch (error) {
      logger.error('Navigation command failed', { error, command });
      return await this.getErrorResponse(command.language);
    }
  }

  /**
   * Handle settings voice command
   */
  private async handleSettingsCommand(command: VoiceCommand, userId: string): Promise<VoiceResponse> {
    try {
      const responseMessages = {
        'en': 'You can change your language, update your profile, or adjust notification settings. What would you like to do?',
        'af': 'Jy kan jou taal verander, jou profiel opdateer, of kennisgewing instellings aanpas. Wat wil jy doen?',
        'zu': 'Ungashintsha ulimi lwakho, ubuyekeze iphrofayela yakho, noma ulungise izilungiselelo zezaziso. Yini ongathanda ukuyenza?',
        'xh': 'Ungayitshintsha ilwimi lakho, uhlaziye iprofayile yakho, okanye ulungelelanise iisetingi zezaziso. Yintoni ongathanda ukuyenza?'
      };
      
      return {
        text: responseMessages[command.language] || responseMessages['en'],
        language: command.language,
        followUpActions: ['change_language', 'edit_profile', 'notification_settings']
      };
      
    } catch (error) {
      logger.error('Settings command failed', { error, command });
      return await this.getErrorResponse(command.language);
    }
  }

  /**
   * Handle help voice command
   */
  private async handleHelpCommand(command: VoiceCommand, userId: string): Promise<VoiceResponse> {
    const helpMessages = {
      'en': 'I can help you search for jobs, apply for positions, navigate the website, and change settings. You can speak in any South African language. What would you like to do?',
      'af': 'Ek kan jou help om werk te soek, vir posisies aan te soek, die webwerf navigeer, en instellings verander. Jy kan in enige Suid-Afrikaanse taal praat. Wat wil jy doen?',
      'zu': 'Ngingakusiza ukusesha imisebenzi, ukufaka izicelo zezikhundla, ukuzulazula iwebhusayithi, nokushintsha izilungiselelo. Ungakhuluma nganoma yiluphi ulimi lwaseNingizimu Afrika. Yini ongathanda ukuyenza?',
      'xh': 'Ndingakunceda ukukhangela imisebenzi, ukufaka izicelo zezikhundla, ukuhamba kwiwebhusayithi, nokutshintsha iisetingi. Ungakwazi ukuthetha naluphi na ulwimi lwaseMzantsi Afrika. Yintoni ongathanda ukuyenza?'
    };
    
    return {
      text: helpMessages[command.language] || helpMessages['en'],
      language: command.language,
      followUpActions: ['search_jobs', 'view_profile', 'change_language', 'learn_more']
    };
  }

  /**
   * Extract search query from voice command
   */
  private extractSearchQuery(text: string, language: SALanguage): string {
    const searchPrefixes = {
      'en': ['find', 'search for', 'look for', 'get me', 'show me'],
      'af': ['soek', 'vind', 'kry vir my', 'wys my'],
      'zu': ['sesha', 'thola', 'nginikeze', 'bonisa'],
      'xh': ['khangela', 'fumana', 'ndinikeze', 'bonisa']
    };
    
    const prefixes = searchPrefixes[language] || searchPrefixes['en'];
    let query = text.toLowerCase();
    
    // Remove search prefixes
    prefixes.forEach(prefix => {
      query = query.replace(new RegExp(`^.*?${prefix}\\s+`, 'i'), '');
    });
    
    return query.trim() || 'jobs';
  }

  /**
   * Extract navigation destination from voice command
   */
  private extractNavigationDestination(text: string, language: SALanguage): string {
    const navCommands = NAVIGATION_COMMANDS[language] || NAVIGATION_COMMANDS['en'];
    const lowerText = text.toLowerCase();
    
    for (const [destination, patterns] of Object.entries(navCommands)) {
      if (patterns.some(pattern => lowerText.includes(pattern))) {
        return destination;
      }
    }
    
    return 'dashboard';
  }

  /**
   * Format search response based on results
   */
  private async formatSearchResponse(jobCount: number, language: SALanguage): Promise<string> {
    const responses = {
      'en': {
        many: `Great! I found ${jobCount} job opportunities for you. Would you like me to read them out or help you apply?`,
        few: `I found ${jobCount} jobs that might interest you. Let me know if you'd like to hear more details.`,
        none: `I couldn't find any jobs matching your search. Try using different keywords or let me help you explore other opportunities.`
      },
      'af': {
        many: `Fantasties! Ek het ${jobCount} werksgeleenthede vir jou gevind. Wil jy hê ek moet hulle voorlees of jou help om aan te soek?`,
        few: `Ek het ${jobCount} werk gevind wat jou mag interesseer. Laat weet as jy meer besonderhede wil hoor.`,
        none: `Ek kon geen werk vind wat by jou soektog pas nie. Probeer ander sleutelwoorde of laat my jou help om ander geleenthede te verken.`
      },
      'zu': {
        many: `Kuhle! Ngithole amathuba omsebenzi angu-${jobCount} kuwe. Ngabe ufuna ngikufundele noma ngikusize ukufaka isicelo?`,
        few: `Ngithole imisebenzi engu-${jobCount} engase ikuthakazelise. Ngitshele uma ufuna ukuzwa imininingwane eyengeziwe.`,
        none: `Angikwazanga ukuthola umsebenzi ohambisana nokusesha kwakho. Zama ukusebenzisa amagama ahlukile noma ngikusize ukuhlola amanye amathuba.`
      },
      'xh': {
        many: `Kuhle! Ndifumene amathuba omsebenzi angu-${jobCount} kuwe. Ngaba ufuna ndikufundele okanye ndikuncede ukufaka izicelo?`,
        few: `Ndifumene imisebenzi engu-${jobCount} enokuba inomdla kuwe. Ndixelele ukuba ufuna ukuva iinkcukacha ezongezelelweyo.`,
        none: `Andikwazanga ukufumana msebenzi uhambelana nokukhangela kwakho. Zama ukusebenzisa amagama ahlukileyo okanye mandikuncede ukuphonononga amanye amathuba.`
      }
    };
    
    const langResponses = responses[language] || responses['en'];
    
    if (jobCount > 10) return langResponses.many;
    if (jobCount > 0) return langResponses.few;
    return langResponses.none;
  }

  /**
   * Get error message in specified language
   */
  private async getErrorMessage(language: SALanguage): Promise<string> {
    const errorMessages = {
      'en': 'Sorry, I had trouble understanding that. Please try speaking clearly or use different words.',
      'af': 'Jammer, ek het sukkel om dit te verstaan. Probeer asseblief duidelik praat of gebruik ander woorde.',
      'zu': 'Ngiyaxolisa, ngibone ubunzima ukuqonda lokho. Sicela ukhulume ngokucacile noma usebenzise amanye amagama.',
      'xh': 'Uxolo, ndibe nobunzima bokukuqonda oko. Nceda uthethe ngokucacileyo okanye usebenzise amanye amagama.'
    };
    
    return errorMessages[language] || errorMessages['en'];
  }

  /**
   * Get error response
   */
  private async getErrorResponse(language: SALanguage): Promise<VoiceResponse> {
    return {
      text: await this.getErrorMessage(language),
      language,
      followUpActions: ['try_again', 'speak_clearly', 'type_instead']
    };
  }

  /**
   * Save audio response and return URL
   */
  private async saveAudioResponse(audioBuffer: Buffer, userId: string): Promise<string> {
    try {
      // In production, save to cloud storage (Cloudinary, AWS S3, etc.)
      const audioId = `voice_response_${userId}_${Date.now()}`;
      
      // TODO: Save audio buffer to cloud storage
      // Return the URL where the audio can be accessed
      
      return `/api/v1/voice/audio/${audioId}`;
      
    } catch (error) {
      logger.error('Failed to save audio response', { error, userId });
      return '';
    }
  }

  /**
   * Get voice command history for user
   */
  async getVoiceHistory(userId: string, limit: number = 10): Promise<any[]> {
    try {
      // In production, store voice commands in database for analytics
      // This would track usage patterns and improve voice recognition
      
      return [];
      
    } catch (error) {
      logger.error('Failed to get voice history', { error, userId });
      return [];
    }
  }

  /**
   * Update voice settings for user
   */
  async updateVoiceSettings(userId: string, settings: any): Promise<void> {
    try {
      // Settings like speech rate, voice type, language preference
      logger.info('Voice settings updated', { userId, settings });
      
    } catch (error) {
      logger.error('Failed to update voice settings', { error, userId });
      throw new AppError('Failed to update voice settings', 500);
    }
  }
}

export default new VoiceOperationService();
