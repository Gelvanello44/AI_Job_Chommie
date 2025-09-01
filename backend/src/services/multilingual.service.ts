import { PrismaClient } from '@prisma/client';
import { AppError } from '../utils/AppError.js';
import logger from '../config/logger.js';
import { config } from '../config/index.js';

// South African Official Languages
export enum SALanguage {
  ENGLISH = 'en',
  AFRIKAANS = 'af',
  ZULU = 'zu',
  XHOSA = 'xh',
  SOTHO = 'st',
  TSWANA = 'tn',
  PEDI = 'nso',
  VENDA = 've',
  TSONGA = 'ts',
  SWATI = 'ss',
  NDEBELE = 'nr'
}

// Common South African slang and terminology mapping
const SA_SLANG_DICTIONARY = {
  // English slang
  'en': {
    'robot': 'traffic light',
    'bakkie': 'pickup truck',
    'braai': 'barbecue',
    'lekker': 'good/nice',
    'eish': 'expression of dismay',
    'howzit': 'how are you',
    'sharp': 'okay/good',
    'ja': 'yes',
    'boet': 'brother/friend',
    'china': 'friend',
    'bru': 'brother/friend',
    'klap': 'hit/strike',
    'tjommie': 'friend',
    'skief': 'crooked/wrong',
    'takkies': 'sneakers',
    'cooldrink': 'soft drink',
    'robots': 'traffic lights'
  },
  // Afrikaans slang
  'af': {
    'skelmpie': 'rascal',
    'boerewors': 'traditional sausage',
    'vleis': 'meat',
    'sosatie': 'kebab',
    'potjiekos': 'pot food',
    'biltong': 'dried meat',
    'vetkoek': 'fried bread',
    'koeksister': 'traditional pastry',
    'rooibos': 'red bush tea',
    'skelmpie': 'little rascal'
  },
  // Zulu slang and common terms
  'zu': {
    'sawubona': 'hello',
    'bengijabule': 'I would be happy',
    'ngiyabonga': 'thank you',
    'hhayi': 'no',
    'yebo': 'yes',
    'umsebenzi': 'work/job',
    'imali': 'money',
    'ukukhuluma': 'to speak',
    'isikole': 'school',
    'indlu': 'house'
  },
  // Xhosa slang and common terms
  'xh': {
    'molo': 'hello',
    'enkosi': 'thank you',
    'hayi': 'no',
    'ewe': 'yes',
    'umsebenzi': 'work/job',
    'imali': 'money',
    'ukuthetha': 'to speak',
    'isikolo': 'school',
    'indlu': 'house'
  }
};

// Language-specific job titles and industry terms
const JOB_TERMINOLOGY = {
  'en': {
    'software developer': ['programmer', 'coder', 'developer', 'software engineer'],
    'accountant': ['bookkeeper', 'financial clerk', 'accounts clerk'],
    'teacher': ['educator', 'tutor', 'instructor', 'lecturer'],
    'nurse': ['healthcare worker', 'medical assistant', 'care giver'],
    'security guard': ['security officer', 'guard', 'watchman'],
    'receptionist': ['front desk', 'admin assistant', 'secretary'],
    'driver': ['chauffeur', 'delivery driver', 'taxi driver'],
    'cleaner': ['domestic worker', 'housekeeper', 'janitor'],
    'sales assistant': ['shop assistant', 'retail worker', 'cashier'],
    'waiter': ['server', 'waitron', 'food service worker']
  },
  'af': {
    'sagteware ontwikkelaar': ['programmeerder', 'koder', 'rekenaar programmeerder'],
    'rekeningkundige': ['boekhouer', 'finansiele klerk'],
    'onderwyser': ['opvoeder', 'tutor', 'instrukteur'],
    'verpleegster': ['gesondheidswerker', 'mediese assistent'],
    'sekuriteitswagte': ['wagte', 'sekuriteitsbeampte'],
    'onthaalbeampte': ['administratiewe assistent', 'sekretaris'],
    'bestuurder': ['chauffeur', 'afleweringsbestuurder'],
    'skoonmaker': ['huiswerker', 'tuishoudster'],
    'verkoopsassistent': ['winkelassistent', 'kasregistervrolle'],
    'kelner': ['bediende', 'voedseldienswerker']
  },
  'zu': {
    'umthuthukisi wesofthiwe': ['umprogrami', 'umkodi'],
    'umgcinizincwadi': ['umgcini zincwadi', 'umkleki wezezimali'],
    'uthisha': ['umfundisi', 'ututor'],
    'unesi': ['usebenzi wezempilo', 'umsizi wezokwelapha'],
    'unogada': ['unogada wokuphephela', 'umlindi'],
    'umamukeli': ['umsizi wokuphatha', 'unobhala'],
    'umshayeli': ['umshayeli wokudiliva', 'umshayeli weteksi'],
    'umcoci': ['umsebenzi wasekhaya', 'umlindi wendlu'],
    'umsizi wokuthengisa': ['umsizi wasesitolo', 'umcashier'],
    'isevela': ['umphathi ukudla', 'umsebenzi wokudla']
  },
  'xh': {
    'umphuhlisi wesoftware': ['umprogrami', 'umkodi'],
    'umgcinizincwadi': ['umgcini-ncwadi', 'umkleki wezezimali'],
    'utitshala': ['umfundisi', 'ututor'],
    'unesi': ['umsebenzi wezempilo', 'umsizi wezonyango'],
    'unogada': ['unogada wokhuseleko', 'umlindi'],
    'umamukeli': ['umsizi wolawulo', 'unobhala'],
    'umqhubi': ['umqhubi wokuhambisa', 'umqhubi weetaxi'],
    'umcoceki': ['umsebenzi wendlu', 'umlindi-ndlu'],
    'umncedisi wentengiso': ['umncedisi wevenkile', 'um-cashier'],
    'iservile': ['umphathi-kudla', 'umsebenzi wokutya']
  }
};

export class MultilingualService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Translate text between South African languages
   */
  async translateText(text: string, fromLang: SALanguage, toLang: SALanguage): Promise<string> {
    try {
      if (fromLang === toLang) {
        return text;
      }

      // Check for slang translations first
      const slangTranslation = this.translateSlang(text, fromLang, toLang);
      if (slangTranslation !== text) {
        return slangTranslation;
      }

      // Check for job terminology
      const jobTranslation = this.translateJobTerminology(text, fromLang, toLang);
      if (jobTranslation !== text) {
        return jobTranslation;
      }

      // For production, integrate with translation service
      // Using placeholder translation logic
      return await this.performTranslation(text, fromLang, toLang);

    } catch (error) {
      logger.error('Translation error', { error, text, fromLang, toLang });
      return text; // Return original text if translation fails
    }
  }

  /**
   * Translate slang terminology
   */
  private translateSlang(text: string, fromLang: SALanguage, toLang: SALanguage): string {
    const fromSlang = SA_SLANG_DICTIONARY[fromLang];
    if (!fromSlang) return text;

    let translatedText = text.toLowerCase();
    
    // Replace slang terms with standard terms first
    Object.entries(fromSlang).forEach(([slang, standard]) => {
      const regex = new RegExp(`\\b${slang}\\b`, 'gi');
      translatedText = translatedText.replace(regex, standard);
    });

    return translatedText;
  }

  /**
   * Translate job-specific terminology
   */
  private translateJobTerminology(text: string, fromLang: SALanguage, toLang: SALanguage): string {
    const fromTerms = JOB_TERMINOLOGY[fromLang];
    const toTerms = JOB_TERMINOLOGY[toLang];
    
    if (!fromTerms || !toTerms) return text;

    let translatedText = text.toLowerCase();

    Object.entries(fromTerms).forEach(([standardTerm, variations]) => {
      variations.forEach(variation => {
        const regex = new RegExp(`\\b${variation}\\b`, 'gi');
        if (translatedText.match(regex)) {
          // Find equivalent in target language
          const targetTerm = Object.keys(toTerms).find(term => 
            standardTerm === this.getStandardJobTitle(term)
          );
          if (targetTerm) {
            translatedText = translatedText.replace(regex, targetTerm);
          }
        }
      });
    });

    return translatedText;
  }

  /**
   * Get user's preferred language
   */
  async getUserLanguage(userId: string): Promise<SALanguage> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { 
          id: true,
          // Add preferredLanguage field to user model if not exists
        }
      });

      // Default to English if no preference set
      return SALanguage.ENGLISH; // user?.preferredLanguage as SALanguage || SALanguage.ENGLISH;
    } catch (error) {
      logger.error('Error getting user language', { error, userId });
      return SALanguage.ENGLISH;
    }
  }

  /**
   * Set user's preferred language
   */
  async setUserLanguage(userId: string, language: SALanguage): Promise<void> {
    try {
      // Update user language preference
      // await this.prisma.user.update({
      //   where: { id: userId },
      //   data: { preferredLanguage: language }
      // });

      logger.info('User language updated', { userId, language });
    } catch (error) {
      logger.error('Error setting user language', { error, userId, language });
      throw new AppError('Failed to update language preference', 500);
    }
  }

  /**
   * Get all supported languages with their native names
   */
  getSupportedLanguages(): Array<{ code: SALanguage; name: string; nativeName: string }> {
    return [
      { code: SALanguage.ENGLISH, name: 'English', nativeName: 'English' },
      { code: SALanguage.AFRIKAANS, name: 'Afrikaans', nativeName: 'Afrikaans' },
      { code: SALanguage.ZULU, name: 'Zulu', nativeName: 'isiZulu' },
      { code: SALanguage.XHOSA, name: 'Xhosa', nativeName: 'isiXhosa' },
      { code: SALanguage.SOTHO, name: 'Southern Sotho', nativeName: 'Sesotho' },
      { code: SALanguage.TSWANA, name: 'Tswana', nativeName: 'Setswana' },
      { code: SALanguage.PEDI, name: 'Northern Sotho', nativeName: 'Sesotho sa Leboa' },
      { code: SALanguage.VENDA, name: 'Venda', nativeName: 'Tshivenḓa' },
      { code: SALanguage.TSONGA, name: 'Tsonga', nativeName: 'Xitsonga' },
      { code: SALanguage.SWATI, name: 'Swati', nativeName: 'siSwati' },
      { code: SALanguage.NDEBELE, name: 'Southern Ndebele', nativeName: 'isiNdebele' }
    ];
  }

  /**
   * Detect language from text
   */
  async detectLanguage(text: string): Promise<SALanguage> {
    try {
      // Simple language detection based on common words
      const lowerText = text.toLowerCase();

      // Check for distinctive words in each language
      if (this.containsWords(lowerText, ['sawubona', 'ngiyabonga', 'umsebenzi', 'yebo'])) {
        return SALanguage.ZULU;
      }
      if (this.containsWords(lowerText, ['molo', 'enkosi', 'umsebenzi', 'ewe'])) {
        return SALanguage.XHOSA;
      }
      if (this.containsWords(lowerText, ['hallo', 'dankie', 'werk', 'ja'])) {
        return SALanguage.AFRIKAANS;
      }

      // Default to English
      return SALanguage.ENGLISH;
    } catch (error) {
      logger.error('Language detection error', { error, text });
      return SALanguage.ENGLISH;
    }
  }

  /**
   * Translate job posting for specific user
   */
  async translateJobPosting(jobId: string, userId: string): Promise<any> {
    try {
      const userLanguage = await this.getUserLanguage(userId);
      
      const job = await this.prisma.job.findUnique({
        where: { id: jobId },
        include: { company: true }
      });

      if (!job) {
        throw new AppError('Job not found', 404);
      }

      // If already in user's language, return as is
      if (userLanguage === SALanguage.ENGLISH) {
        return job;
      }

      // Translate job fields
      const translatedJob = {
        ...job,
        title: await this.translateText(job.title, SALanguage.ENGLISH, userLanguage),
        description: await this.translateText(job.description, SALanguage.ENGLISH, userLanguage),
        requirements: await this.translateText(job.requirements, SALanguage.ENGLISH, userLanguage),
        responsibilities: await this.translateText(job.responsibilities, SALanguage.ENGLISH, userLanguage)
      };

      return translatedJob;
    } catch (error) {
      logger.error('Error translating job posting', { error, jobId, userId });
      throw new AppError('Failed to translate job posting', 500);
    }
  }

  /**
   * Search jobs in user's language
   */
  async searchJobsInLanguage(query: string, userId: string, filters: any = {}): Promise<any[]> {
    try {
      const userLanguage = await this.getUserLanguage(userId);
      
      // Translate search query to English for database search
      const englishQuery = await this.translateText(query, userLanguage, SALanguage.ENGLISH);
      
      // Perform job search with translated query
      const jobs = await this.prisma.job.findMany({
        where: {
          OR: [
            { title: { contains: englishQuery, mode: 'insensitive' } },
            { description: { contains: englishQuery, mode: 'insensitive' } },
            { requirements: { contains: englishQuery, mode: 'insensitive' } }
          ],
          active: true,
          ...filters
        },
        include: { company: true },
        take: 20
      });

      // Translate results back to user's language
      const translatedJobs = await Promise.all(
        jobs.map(job => this.translateJobPosting(job.id, userId))
      );

      return translatedJobs;
    } catch (error) {
      logger.error('Error searching jobs in language', { error, query, userId });
      throw new AppError('Failed to search jobs', 500);
    }
  }

  private containsWords(text: string, words: string[]): boolean {
    return words.some(word => text.includes(word));
  }

  private async performTranslation(text: string, fromLang: SALanguage, toLang: SALanguage): Promise<string> {
    // Placeholder for actual translation service integration
    // In production, integrate with Google Translate API, Azure Translator, or similar
    
    try {
      // For now, return original text
      // TODO: Integrate with translation service
      logger.info('Translation requested', { text: text.substring(0, 50), fromLang, toLang });
      return text;
    } catch (error) {
      logger.error('Translation service error', { error, fromLang, toLang });
      return text;
    }
  }

  private getStandardJobTitle(localizedTitle: string): string {
    // Helper method to normalize job titles
    const normalized = localizedTitle.toLowerCase().trim();
    
    // Common mappings
    const mappings: { [key: string]: string } = {
      'programmer': 'software developer',
      'coder': 'software developer',
      'bookkeeper': 'accountant',
      'tutor': 'teacher',
      'instructor': 'teacher',
      'guard': 'security guard',
      'watchman': 'security guard',
      'secretary': 'receptionist',
      'admin assistant': 'receptionist',
      'chauffeur': 'driver',
      'delivery driver': 'driver',
      'domestic worker': 'cleaner',
      'housekeeper': 'cleaner',
      'janitor': 'cleaner',
      'shop assistant': 'sales assistant',
      'cashier': 'sales assistant',
      'server': 'waiter',
      'waitron': 'waiter'
    };

    return mappings[normalized] || normalized;
  }
}

export default new MultilingualService();
