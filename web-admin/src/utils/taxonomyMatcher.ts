/**
 * Deterministic Taxonomy Matcher
 * Maps question content to existing database Exams, Subjects, and Topics
 * using exact/fuzzy keyword matching rather than generative hallucination.
 */

import { Subject, Topic } from '../types';

export interface TaxonomyMatchResult {
  subject: string;
  topic: string;
  confidence: 'HIGH' | 'REVIEW';
  warning?: string;
}

// Built-in domain keyword heuristics for Indian competitive exams & Andaman GK
const DOMAIN_KEYWORDS: Record<string, { subject: string; topics: string[] }> = {
  andaman: {
    subject: 'Andaman & Nicobar GK',
    topics: [
      'Geography of Andaman',
      'Tribes of Andaman',
      'History of Cellular Jail',
      'Flora & Fauna',
      'Administrative Setup'
    ]
  },
  polity: {
    subject: 'General Awareness',
    topics: ['Indian Constitution', 'Fundamental Rights', 'Parliament', 'Judiciary']
  },
  history: {
    subject: 'General Awareness',
    topics: ['Ancient History', 'Medieval History', 'Modern Indian History', 'National Movement']
  },
  geography: {
    subject: 'General Awareness',
    topics: ['Indian Geography', 'Rivers & Mountains', 'Climate & Soil']
  },
  science: {
    subject: 'General Science',
    topics: ['Physics', 'Chemistry', 'Biology', 'Environment']
  },
  math: {
    subject: 'Quantitative Aptitude',
    topics: ['Percentage', 'Profit and Loss', 'Time and Work', 'Speed and Distance', 'Geometry', 'Algebra']
  },
  reasoning: {
    subject: 'General Intelligence',
    topics: ['Coding-Decoding', 'Blood Relations', 'Syllogism', 'Series', 'Analogy']
  },
  english: {
    subject: 'English Language',
    topics: ['Grammar', 'Vocabulary', 'Synonyms & Antonyms', 'Comprehension', 'Idioms']
  }
};

/**
 * Tokenizes and normalizes text for word frequency lookup.
 */
function getKeywords(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
  return new Set(words);
}

/**
 * Deterministically classifies a question into an existing Subject and Topic.
 * If match confidence is low, uses defaults and flags a review warning.
 */
export function matchDeterministicTaxonomy(
  questionText: string,
  explanationText: string = '',
  subjects: Subject[] = [],
  topics: Topic[] = [],
  defaults: { subject?: string; topic?: string } = {}
): TaxonomyMatchResult {
  const combinedText = `${questionText} ${explanationText}`.toLowerCase();
  const tokens = getKeywords(combinedText);

  // 1. High priority check: Andaman Special GK keywords
  const andamanKeywords = [
    'andaman', 'nicobar', 'port blair', 'cellular jail', 'jarawa', 'sentinelese',
    'shompen', 'onge', 'great andamanese', 'barren island', 'ross island', 'havelock',
    'neil island', 'radhanagar', 'diglipur', 'mayabunder', 'car nicobar', 'ten degree channel'
  ];

  for (const kw of andamanKeywords) {
    if (combinedText.includes(kw)) {
      const andamanSubject = subjects.find(
        (s) => s.isAndamanSpecial || /andaman/i.test(s.name)
      )?.name || 'Andaman & Nicobar GK';

      // Find matching topic if available
      const matchingTopic = topics.find(
        (t) => /andaman|tribe|geography|history/i.test(t.name)
      )?.name || defaults.topic || 'General Knowledge';

      return {
        subject: andamanSubject,
        topic: matchingTopic,
        confidence: 'HIGH',
      };
    }
  }

  // 2. Exact match against existing Topic names from Firestore
  for (const topic of topics) {
    const topicTokens = getKeywords(topic.name);
    let matchCount = 0;
    for (const t of topicTokens) {
      if (tokens.has(t)) matchCount++;
    }

    if (topicTokens.size > 0 && matchCount === topicTokens.size) {
      const parentSubject = subjects.find((s) => s.id === topic.subjectId)?.name || defaults.subject || 'General Awareness';
      return {
        subject: parentSubject,
        topic: topic.name,
        confidence: 'HIGH',
      };
    }
  }

  // 3. Match against built-in subject domains
  if (/\b(sin|cos|tan|triangle|hypotenuse|radius|lcm|hcf|ratio|proportion|speed|km\/h|percentage|profit|loss)\b/i.test(combinedText)) {
    const subj = subjects.find((s) => /math|quant/i.test(s.name))?.name || 'Quantitative Aptitude';
    return {
      subject: subj,
      topic: defaults.topic || 'Arithmetic',
      confidence: 'HIGH',
    };
  }

  if (/\b(constitution|article \d+|fundamental rights|president of india|parliament|lok sabha|rajya sabha|supreme court)\b/i.test(combinedText)) {
    const subj = subjects.find((s) => /polity|awareness/i.test(s.name))?.name || 'General Awareness';
    return {
      subject: subj,
      topic: 'Indian Polity',
      confidence: 'HIGH',
    };
  }

  if (/\b(synonym|antonym|spelling|preposition|passive voice|direct speech|idiom)\b/i.test(combinedText)) {
    const subj = subjects.find((s) => /english/i.test(s.name))?.name || 'English Language';
    return {
      subject: subj,
      topic: 'Vocabulary & Grammar',
      confidence: 'HIGH',
    };
  }

  // 4. Default fallback when classification is ambiguous (never invent)
  return {
    subject: defaults.subject || 'General Awareness',
    topic: defaults.topic || 'General',
    confidence: 'REVIEW',
    warning: 'Taxonomy unclassified — please review subject and topic',
  };
}
