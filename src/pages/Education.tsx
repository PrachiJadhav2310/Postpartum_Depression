import React, { useState, useEffect } from 'react';
import { Book, Play, Download, Clock, Star, Search, Filter, Users, Heart, Brain, Activity, Loader2, X } from 'lucide-react';
import { educationAPI } from '../services/api';

interface Resource {
  id: string | number;
  title: string;
  description: string;
  type: 'article' | 'video' | 'podcast' | 'guide' | 'course';
  category: string;
  duration?: string;
  rating?: number;
  author?: string;
  thumbnail_url?: string;
  content_url?: string;
  featured?: boolean;
  content?: string; // Full article content
}

const Education: React.FC = () => {
  type ArticleLang = 'en' | 'hi' | 'mr';
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [articleLang, setArticleLang] = useState<ArticleLang>('en');
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingResource, setLoadingResource] = useState(false);
  const [fullResource, setFullResource] = useState<Resource | null>(null);

  type CategoryPill = {
    id: string;
    name: string;
    icon: React.ComponentType<{ className?: string }>;
  };

  const defaultCategories: CategoryPill[] = [
    { id: 'all', name: 'All Topics', icon: Book },
    { id: 'postpartum-care', name: 'Postpartum Care', icon: Heart },
    { id: 'mental-health', name: 'Mental Health', icon: Brain },
    { id: 'breastfeeding', name: 'Breastfeeding', icon: Users },
    { id: 'baby-care', name: 'Baby Care', icon: Users },
    { id: 'recovery', name: 'Recovery', icon: Activity },
  ];

  const [categories, setCategories] = useState<CategoryPill[]>(defaultCategories);

  const getFallbackThumbnail = (label: string) => {
    const safeLabel = (label || '').slice(0, 40);
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#fb7185"/>
            <stop offset="100%" stop-color="#a78bfa"/>
          </linearGradient>
        </defs>
        <rect width="800" height="600" rx="24" fill="url(#g)"/>
        <circle cx="670" cy="140" r="90" fill="rgba(255,255,255,0.18)"/>
        <circle cx="120" cy="520" r="140" fill="rgba(255,255,255,0.12)"/>
        <g fill="rgba(255,255,255,0.96)">
          <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle"
            font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700">
            Whispers of Motherhood
          </text>
          <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle"
            font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="600">
            ${safeLabel.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}
          </text>
        </g>
      </svg>
    `;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  };

  const normalizeCategoryName = (categoryId: string) => {
    return categoryId
      .split('-')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  };

  const getCategoryIcon = (categoryId: string) => {
    switch (categoryId) {
      case 'postpartum-care':
        return Heart;
      case 'mental-health':
        return Brain;
      case 'breastfeeding':
      case 'baby-care':
        return Users;
      case 'recovery':
        return Activity;
      default:
        return Book;
    }
  };

  // Fetch resources from API
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 350);

    return () => clearTimeout(timeout);
  }, [searchQuery]);

  // Fetch resources from API
  useEffect(() => {
    fetchResources();
  }, [selectedCategory, debouncedSearchQuery]);

  // Fetch categories from API (falls back to hardcoded defaults)
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await educationAPI.getCategories();
        const serverCategories =
          response?.success && Array.isArray(response.data?.categories)
            ? (response.data.categories as Array<{ category?: string }>)
            : null;

        if (!serverCategories || serverCategories.length === 0) return;

        const uniqueCategoryIds = Array.from(
          new Set(
            serverCategories
              .map((c) => c.category)
              .filter((c): c is string => Boolean(c))
          )
        );

        const mapped: CategoryPill[] = uniqueCategoryIds.map((catId) => ({
          id: catId,
          name: normalizeCategoryName(catId),
          icon: getCategoryIcon(catId),
        }));

        setCategories([{ id: 'all', name: 'All Topics', icon: Book }, ...mapped]);
      } catch (error) {
        console.error('Error fetching education categories:', error);
        setCategories(defaultCategories);
      }
    };

    loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchResources = async () => {
    try {
      setLoading(true);
      const params: { category?: string; search?: string } = {};
      if (selectedCategory !== 'all') {
        params.category = selectedCategory;
      }
      if (debouncedSearchQuery) {
        params.search = debouncedSearchQuery;
      }
      
      const response = await educationAPI.getResources(params);
      if (response.success && Array.isArray(response.data?.resources)) {
        // If backend table is empty, we still want the UI to be functional.
        // Fall back to sample content when no resources are returned.
        const apiResources = response.data.resources;
        setResources(apiResources.length > 0 ? apiResources : getSampleResources());
      } else {
        // Fallback to sample data if API fails
        setResources(getSampleResources());
      }
    } catch (error) {
      console.error('Error fetching resources:', error);
      // Fallback to sample data
      setResources(getSampleResources());
    } finally {
      setLoading(false);
    }
  };

  const getSampleResources = (): Resource[] => [
    {
      id: '1',
      title: 'Understanding Postpartum Depression',
      description: 'A comprehensive guide to recognizing, understanding, and managing postpartum depression symptoms.',
      type: 'article',
      category: 'mental-health',
      duration: '15 min read',
      rating: 4.8,
      author: 'Dr. Sarah Johnson, MD',
      featured: true,
      thumbnail_url: 'https://source.unsplash.com/featured/800x600?postpartum,depression,mother,baby',
      content: getArticleContent('depression'),
    },
    {
      id: '2',
      title: 'Breastfeeding Basics: Getting Started',
      description: 'Essential tips and techniques for new mothers beginning their breastfeeding journey.',
      type: 'video',
      category: 'breastfeeding',
      duration: '20 min',
      rating: 4.9,
      author: 'Lactation Consultant Mary Smith',
      featured: true,
      thumbnail_url: 'https://source.unsplash.com/featured/800x600?breastfeeding,mother,baby',
      content_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', // Sample YouTube embed
    },
    {
      id: '3',
      title: 'Postpartum Recovery Timeline',
      description: 'What to expect during your physical and emotional recovery after childbirth.',
      type: 'guide',
      category: 'recovery',
      duration: '12 min read',
      rating: 4.7,
      author: 'Midwife Jennifer Brown',
      thumbnail_url: 'https://source.unsplash.com/featured/800x600?postpartum,recovery,mother',
      content: getArticleContent('recovery'),
    },
    {
      id: '4',
      title: 'Sleep Training Your Newborn',
      description: 'Gentle approaches to help your baby develop healthy sleep patterns.',
      type: 'podcast',
      category: 'baby-care',
      duration: '35 min',
      rating: 4.6,
      author: 'Pediatric Sleep Specialist Dr. Mike Wilson',
      thumbnail_url: 'https://source.unsplash.com/featured/800x600?newborn,sleep,baby',
      content_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    },
    {
      id: '5',
      title: 'Managing Postpartum Anxiety',
      description: 'Practical strategies for coping with anxiety during the postpartum period.',
      type: 'article',
      category: 'mental-health',
      duration: '10 min read',
      rating: 4.8,
      author: 'Licensed Therapist Anna Davis',
      thumbnail_url: 'https://source.unsplash.com/featured/800x600?anxiety,mother,baby',
      content: getArticleContent('anxiety'),
    },
    {
      id: '6',
      title: 'Nutrition for Breastfeeding Mothers',
      description: 'Essential nutrition guidelines to support both mother and baby during breastfeeding.',
      type: 'guide',
      category: 'postpartum-care',
      duration: '18 min read',
      rating: 4.5,
      author: 'Registered Dietitian Lisa Chen',
      thumbnail_url: 'https://source.unsplash.com/featured/800x600?nutrition,healthy,meal,mother',
      content: getArticleContent('nutrition'),
    },
    {
      id: '7',
      title: 'Coping With Overwhelm: A Gentle Plan',
      description: 'Simple coping steps to reduce overwhelm and help you feel more grounded.',
      type: 'article',
      category: 'mental-health',
      duration: '9 min read',
      rating: 4.7,
      author: 'Therapist Team',
      featured: false,
      thumbnail_url: 'https://source.unsplash.com/featured/800x600?overwhelm,mother,baby',
      content: getArticleContent('overwhelm'),
    },
    {
      id: '8',
      title: 'Healing After Birth: What’s Normal and What Isn’t',
      description: 'A clear guide to recovery expectations and warning signs postpartum.',
      type: 'article',
      category: 'recovery',
      duration: '12 min read',
      rating: 4.6,
      author: 'Midwife Jennifer Brown',
      featured: false,
      thumbnail_url: 'https://source.unsplash.com/featured/800x600?healing,postpartum,mother',
      content: getArticleContent('recovery'),
    },
    {
      id: '9',
      title: 'Breastfeeding Basics: Latch, Comfort, and Supply',
      description: 'Get started with practical tips for latch comfort and supporting healthy supply.',
      type: 'article',
      category: 'breastfeeding',
      duration: '11 min read',
      rating: 4.8,
      author: 'Lactation Consultant Mary Smith',
      featured: true,
      thumbnail_url: 'https://source.unsplash.com/featured/800x600?breastfeeding,latch,mother',
      content: getArticleContent('breastfeeding'),
    },
    {
      id: '10',
      title: 'Sleep Deprivation and Your Mood: Practical Steps',
      description: 'How to protect your mental wellbeing when sleep is hard and your routine is changing.',
      type: 'article',
      category: 'baby-care',
      duration: '10 min read',
      rating: 4.5,
      author: 'Sleep Coach Team',
      featured: false,
      thumbnail_url: 'https://source.unsplash.com/featured/800x600?sleep,deprivation,mother',
      content: getArticleContent('sleep'),
    },
    {
      id: '11',
      title: 'Mother-Infant Bonding: Small Moments That Matter',
      description: 'Bonding tips you can try even when you’re tired, busy, or emotionally drained.',
      type: 'article',
      category: 'baby-care',
      duration: '8 min read',
      rating: 4.6,
      author: 'Postpartum Support Specialist',
      featured: false,
      thumbnail_url: 'https://source.unsplash.com/featured/800x600?bonding,mother,baby',
      content: getArticleContent('bonding'),
    },
    {
      id: '12',
      title: 'Building Your Postpartum Nutrition Routine',
      description: 'Turn nutrition guidance into an easy daily routine for faster recovery.',
      type: 'article',
      category: 'postpartum-care',
      duration: '7 min read',
      rating: 4.4,
      author: 'Registered Dietitian Lisa Chen',
      featured: false,
      thumbnail_url: 'https://source.unsplash.com/featured/800x600?nutrition,postpartum,meal',
      content: getArticleContent('nutrition_routine'),
    },
  ];

  const getArticleContent = (topic: string): string => {
    const contents: Record<string, string> = {
      depression: `
        <h3>Understanding Postpartum Depression</h3>
        <p>Postpartum depression (PPD) is a serious mental health condition that affects many new mothers. It's important to recognize the signs and seek help when needed.</p>
        
        <h4>Symptoms and Signs</h4>
        <p>Common symptoms include:</p>
        <ul>
          <li>Persistent feelings of sadness, hopelessness, or emptiness</li>
          <li>Loss of interest in activities you once enjoyed</li>
          <li>Changes in appetite or sleep patterns</li>
          <li>Difficulty bonding with your baby</li>
          <li>Feelings of worthlessness or guilt</li>
          <li>Difficulty concentrating or making decisions</li>
          <li>Thoughts of harming yourself or your baby</li>
        </ul>
        
        <h4>Risk Factors</h4>
        <p>Several factors can increase your risk of developing PPD:</p>
        <ul>
          <li>History of depression or anxiety</li>
          <li>Lack of social support</li>
          <li>Stressful life events</li>
          <li>Complications during pregnancy or delivery</li>
          <li>Hormonal changes after childbirth</li>
        </ul>
        
        <h4>Treatment Options</h4>
        <p>PPD is treatable with the right support:</p>
        <ul>
          <li><strong>Therapy:</strong> Cognitive behavioral therapy (CBT) and interpersonal therapy can be very effective</li>
          <li><strong>Medication:</strong> Antidepressants may be recommended, and many are safe while breastfeeding</li>
          <li><strong>Support Groups:</strong> Connecting with other mothers experiencing similar challenges</li>
          <li><strong>Self-Care:</strong> Prioritizing rest, nutrition, and activities you enjoy</li>
        </ul>
        
        <h4>When to Seek Professional Help</h4>
        <p>If you're experiencing symptoms of PPD, it's important to reach out to a healthcare provider. Don't wait - early intervention leads to better outcomes. If you have thoughts of self-harm, seek immediate emergency help.</p>
        
        <h4>Self-Care Strategies</h4>
        <ul>
          <li>Get as much rest as possible</li>
          <li>Eat nutritious meals regularly</li>
          <li>Ask for help from family and friends</li>
          <li>Make time for activities you enjoy</li>
          <li>Connect with other new mothers</li>
          <li>Be patient with yourself - recovery takes time</li>
        </ul>
      `,
      anxiety: `
        <h3>Managing Postpartum Anxiety</h3>
        <p>Postpartum anxiety is common and manageable with the right strategies and support.</p>
        
        <h4>Understanding Postpartum Anxiety</h4>
        <p>Anxiety after childbirth can manifest in various ways, including excessive worry, physical symptoms, and difficulty sleeping even when the baby is sleeping.</p>
        
        <h4>Common Symptoms</h4>
        <ul>
          <li>Excessive worry about your baby's health and safety</li>
          <li>Racing thoughts or inability to relax</li>
          <li>Physical symptoms like rapid heartbeat, sweating, or nausea</li>
          <li>Difficulty sleeping even when exhausted</li>
          <li>Irritability or restlessness</li>
          <li>Difficulty concentrating</li>
        </ul>
        
        <h4>Practical Coping Strategies</h4>
        <ul>
          <li><strong>Deep Breathing:</strong> Practice 4-7-8 breathing (inhale 4, hold 7, exhale 8)</li>
          <li><strong>Mindfulness:</strong> Take moments to ground yourself in the present</li>
          <li><strong>Limit Information Overload:</strong> Avoid excessive Googling about baby health</li>
          <li><strong>Create Routines:</strong> Predictable schedules can reduce anxiety</li>
          <li><strong>Accept Help:</strong> Let others assist with baby care and household tasks</li>
        </ul>
        
        <h4>When to Seek Help</h4>
        <p>If anxiety is interfering with your daily life or ability to care for yourself or your baby, reach out to a healthcare provider. Treatment options include therapy, medication, or both.</p>
      `,
      recovery: `
        <h3>Postpartum Recovery Timeline</h3>
        <p>Understanding what to expect during your recovery can help you prepare and recognize when to seek help.</p>
        
        <h4>First 24 Hours</h4>
        <ul>
          <li>Rest as much as possible</li>
          <li>Begin gentle movement if cleared by your healthcare provider</li>
          <li>Start pain management as recommended</li>
          <li>Begin bonding with your baby</li>
        </ul>
        
        <h4>Week 1</h4>
        <ul>
          <li>Continue rest and recovery</li>
          <li>Monitor bleeding and healing</li>
          <li>Establish feeding routine</li>
          <li>Accept help from others</li>
        </ul>
        
        <h4>Weeks 2-4</h4>
        <ul>
          <li>Gradually increase activity level</li>
          <li>Continue monitoring physical recovery</li>
          <li>Watch for signs of infection</li>
          <li>Begin gentle exercises if cleared</li>
        </ul>
        
        <h4>Weeks 4-6</h4>
        <ul>
          <li>Postpartum checkup with healthcare provider</li>
          <li>Discuss birth control options</li>
          <li>Evaluate emotional well-being</li>
          <li>Consider returning to regular activities gradually</li>
        </ul>
        
        <h4>Warning Signs to Watch For</h4>
        <ul>
          <li>Excessive bleeding</li>
          <li>Signs of infection (fever, redness, discharge)</li>
          <li>Severe pain</li>
          <li>Difficulty breathing</li>
          <li>Persistent emotional distress</li>
        </ul>
      `,
      nutrition: `
        <h3>Nutrition for Breastfeeding Mothers</h3>
        <p>Proper nutrition is essential for both your recovery and your baby's health during breastfeeding.</p>
        
        <h4>Caloric Needs</h4>
        <p>Breastfeeding mothers typically need an additional 300-500 calories per day. Focus on nutrient-dense foods rather than empty calories.</p>
        
        <h4>Essential Nutrients</h4>
        <ul>
          <li><strong>Protein:</strong> Aim for lean meats, fish, eggs, legumes, and dairy</li>
          <li><strong>Calcium:</strong> Important for bone health - include dairy, leafy greens, and fortified foods</li>
          <li><strong>Iron:</strong> Prevent anemia with lean meats, beans, and iron-fortified cereals</li>
          <li><strong>Omega-3s:</strong> Support baby's brain development with fish, walnuts, and flaxseeds</li>
          <li><strong>Folate:</strong> Continue prenatal vitamins and eat leafy greens</li>
        </ul>
        
        <h4>Hydration</h4>
        <p>Drink plenty of water - aim for 8-10 glasses daily. Keep a water bottle nearby while breastfeeding.</p>
        
        <h4>Foods to Include</h4>
        <ul>
          <li>Whole grains for sustained energy</li>
          <li>Fruits and vegetables for vitamins and fiber</li>
          <li>Healthy fats from avocados, nuts, and olive oil</li>
          <li>Lean proteins for tissue repair</li>
        </ul>
        
        <h4>Foods to Limit</h4>
        <ul>
          <li>Excessive caffeine (limit to 1-2 cups per day)</li>
          <li>Alcohol (if consumed, wait 2-3 hours before breastfeeding)</li>
          <li>Highly processed foods</li>
          <li>Excessive sugar</li>
        </ul>
        
        <h4>Meal Planning Tips</h4>
        <ul>
          <li>Prepare snacks in advance</li>
          <li>Keep healthy options easily accessible</li>
          <li>Eat frequent, smaller meals</li>
          <li>Continue taking prenatal vitamins</li>
        </ul>
      `,
      breastfeeding: `
        <h3>Breastfeeding Basics: Latch, Comfort, and Supply</h3>
        <p>Breastfeeding can feel challenging at first. With a little practice and support, most mothers and babies find a comfortable rhythm.</p>
        
        <h4>Latch and Comfort</h4>
        <ul>
          <li>Aim for a deep latch (more areola visible above the baby’s top lip)</li>
          <li>Check for pain that persists after the first few minutes</li>
          <li>If you’re unsure, consider working with a lactation consultant</li>
        </ul>

        <h4>Supporting Healthy Supply</h4>
        <ul>
          <li>Feed frequently in the early weeks</li>
          <li>Use both breasts each session if recommended by your provider</li>
          <li>Stay hydrated and prioritize rest when possible</li>
        </ul>

        <h4>When to Seek Help</h4>
        <p>Reach out if you have severe pain, signs of infection, or concerns about milk transfer.</p>
      `,

      sleep: `
        <h3>Sleep Deprivation and Your Mood: Practical Steps</h3>
        <p>Sleep disruption is common postpartum. Protecting your mental wellbeing is just as important as caring for your baby.</p>
        
        <h4>Small Changes That Help</h4>
        <ul>
          <li>Take short naps when possible (even 20-30 minutes can help)</li>
          <li>Share nighttime tasks with a partner or support person</li>
          <li>Create a simple wind-down routine for you</li>
        </ul>

        <h4>Preventing the “All-or-Nothing” Trap</h4>
        <p>If sleep is poor, focus on what you can control: hydration, light meals, and gentle routines.</p>

        <h4>Get Support</h4>
        <p>If fatigue feels unmanageable or you’re experiencing persistent low mood, consider contacting a healthcare provider.</p>
      `,

      bonding: `
        <h3>Mother-Infant Bonding: Small Moments That Matter</h3>
        <p>Bonding can look different for every mother. Feeling distant at times is not uncommon—especially when you’re exhausted.</p>
        
        <h4>Gentle Ways to Connect</h4>
        <ul>
          <li>Try skin-to-skin when it feels safe and comfortable</li>
          <li>Use a quiet moment for eye contact or soft talking</li>
          <li>Notice one thing your baby does that feels soothing to you</li>
        </ul>

        <h4>When to Reach Out</h4>
        <p>If bonding feels painful or overwhelmingly difficult, you deserve support and guidance.</p>
      `,

      overwhelm: `
        <h3>Coping With Overwhelm: A Gentle Plan</h3>
        <p>Overwhelm can show up as irritability, tearfulness, racing thoughts, or feeling “stuck.” The goal is not perfection—it’s steadiness.</p>
        
        <h4>Try the 3-Step Reset</h4>
        <ul>
          <li>Slow your breathing for 60 seconds (inhale 4, exhale 6)</li>
          <li>Choose one tiny next action (something you can finish in 2 minutes)</li>
          <li>Ask for support with a specific request (example: “Can you hold the baby while I shower?”)</li>
        </ul>

        <h4>Make It Easier</h4>
        <p>Reduce decision fatigue: prepare one “go-to” meal, limit visitors if needed, and use reminders for medications or appointments.</p>
      `,

      nutrition_routine: `
        <h3>Building Your Postpartum Nutrition Routine</h3>
        <p>When time is limited, nutrition becomes a routine rather than a task. Small, repeatable meals can support recovery.</p>
        
        <h4>Make It Simple</h4>
        <ul>
          <li>Pick 2-3 quick breakfasts (yogurt, oatmeal, eggs, smoothies)</li>
          <li>Keep a protein snack within reach</li>
          <li>Use one pan or one pot meals for easy dinners</li>
        </ul>

        <h4>Hydration Reminder</h4>
        <p>Try a water bottle strategy: keep it visible, take sips between feeding sessions, and refill often.</p>
      `,
    };
    return contents[topic] || '<p>Content coming soon...</p>';
  };

  const handleResourceClick = async (resource: Resource) => {
    setSelectedResource(resource);
    setLoadingResource(true);
    
    try {
      // Fetch full resource details from API
      const response = await educationAPI.getResource(resource.id);
      if (response.success && response.data?.resource) {
        setFullResource(response.data.resource);
      } else {
        // Use the resource we already have
        setFullResource(resource);
      }
    } catch (error) {
      console.error('Error fetching resource details:', error);
      // Use the resource we already have
      setFullResource(resource);
    } finally {
      setLoadingResource(false);
    }
  };

  const getVideoEmbedUrl = (url: string | undefined): string | null => {
    if (!url) return null;
    
    // YouTube URL patterns
    const youtubeRegex = /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/;
    const youtubeMatch = url.match(youtubeRegex);
    if (youtubeMatch) {
      return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
    }
    
    // Vimeo URL patterns
    const vimeoRegex = /(?:vimeo\.com\/)(?:.*\/)?(\d+)/;
    const vimeoMatch = url.match(vimeoRegex);
    if (vimeoMatch) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    }
    
    // If it's already an embed URL or direct video URL, return as is
    if (url.includes('embed') || url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.ogg')) {
      return url;
    }
    
    return null;
  };

  const AUDIO_EXT_REGEX = /\.(mp3|wav|ogg|m4a|aac|flac)(\?.*)?$/i;

  const getAudioUrl = (url: string | undefined): string | null => {
    if (!url) return null;
    return AUDIO_EXT_REGEX.test(url) ? url : null;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'video': return <Play className="h-4 w-4" />;
      case 'podcast': return <Play className="h-4 w-4" />;
      case 'guide': return <Download className="h-4 w-4" />;
      case 'course': return <Download className="h-4 w-4" />;
      default: return <Book className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'video': return 'bg-red-100 text-red-700';
      case 'podcast': return 'bg-purple-100 text-purple-700';
      case 'guide': return 'bg-green-100 text-green-700';
      case 'course': return 'bg-teal-100 text-teal-700';
      default: return 'bg-blue-100 text-blue-700';
    }
  };

  const getQuickTakeaways = (resource: Resource): string[] => {
    const isHindi = articleLang === 'hi';
    const isMarathi = articleLang === 'mr';

    if (resource.category === 'mental-health') {
      if (isHindi) {
        return [
          'आपकी भावनाएँ महत्वपूर्ण हैं, और सहायता उपलब्ध है।',
          'छोटे दैनिक कदम रिकवरी को आसान बनाते हैं।',
          'जल्दी मदद लेने से बेहतर परिणाम मिलते हैं।'
        ];
      }
      if (isMarathi) {
        return [
          'तुमच्या भावना महत्त्वाच्या आहेत आणि मदत उपलब्ध आहे.',
          'दररोजचे छोटे उपाय पुनर्प्राप्ती सुलभ करतात.',
          'लवकर मदत घेतल्यास परिणाम अधिक चांगले होतात.'
        ];
      }
      return [
        'Your feelings are valid, and support is available.',
        'Small daily steps can make recovery easier.',
        'Early help usually leads to better outcomes.'
      ];
    }
    if (resource.category === 'breastfeeding') {
      if (isHindi) {
        return [
          'सही लैच समय से ज़्यादा महत्वपूर्ण है।',
          'पानी और आराम दूध उत्पादन में मदद करते हैं।',
          'दर्द जारी रहे तो विशेषज्ञ से बात करें।'
        ];
      }
      if (isMarathi) {
        return [
          'योग्य latch वेळेपेक्षा अधिक महत्त्वाचा असतो.',
          'पाणी आणि विश्रांती दूधपुरवठ्याला मदत करतात.',
          'दुखणे सुरू राहिल्यास तज्ञांची मदत घ्या.'
        ];
      }
      return [
        'A good latch matters more than perfect timing.',
        'Hydration and rest can support milk supply.',
        'Ask a lactation expert if pain continues.'
      ];
    }
    if (resource.category === 'recovery') {
      if (isHindi) {
        return [
          'रिकवरी धीरे-धीरे होती है और हर माँ में अलग हो सकती है।',
          'गंभीर लक्षणों को नज़रअंदाज़ न करें।',
          'फॉलो-अप चेकअप ज़रूर रखें।'
        ];
      }
      if (isMarathi) {
        return [
          'बरे होणे हळूहळू होते आणि प्रत्येक आईसाठी वेगळे असू शकते.',
          'गंभीर लक्षणांकडे दुर्लक्ष करू नका.',
          'फॉलो-अप तपासणी वेळेवर करा.'
        ];
      }
      return [
        'Healing is gradual and different for every mother.',
        'Watch warning signs and do not ignore severe symptoms.',
        'Follow-up checkups are important for safe recovery.'
      ];
    }
    if (resource.category === 'baby-care') {
      if (isHindi) {
        return [
          'सरल रूटीन माँ और बच्चे दोनों का तनाव कम करता है।',
          'शुरुआती हफ्तों में नींद बदलना सामान्य है।',
          'थकान होने पर मदद माँगना सही है।'
        ];
      }
      if (isMarathi) {
        return [
          'सोपे रूटीन आई आणि बाळ दोघांचाही ताण कमी करते.',
          'पहिल्या आठवड्यांत झोपेतील बदल सामान्य असतात.',
          'थकवा जाणवल्यास मदत मागणे योग्य आहे.'
        ];
      }
      return [
        'Simple routines reduce stress for both you and baby.',
        'Sleep changes are normal in early weeks.',
        'Ask for help when you feel exhausted.'
      ];
    }
    if (isHindi) {
      return [
        'आज इस लेख से एक छोटा कदम चुनें।',
        'अपने भरोसेमंद सपोर्ट सिस्टम से जुड़ें।',
        'लक्षण बढ़ें तो विशेषज्ञ से तुरंत संपर्क करें।'
      ];
    }
    if (isMarathi) {
      return [
        'आज या लेखातून एक छोटा उपाय निवडा.',
        'विश्वासू सपोर्ट सिस्टीमशी संपर्क ठेवा.',
        'लक्षणे वाढल्यास तज्ञांशी संपर्क करा.'
      ];
    }
    return [
      'Start with one small step from this article today.',
      'Use trusted support systems around you.',
      'Reach out to a professional if symptoms worsen.'
    ];
  };

  const getNextSteps = (resource: Resource): string[] => {
    const isHindi = articleLang === 'hi';
    const isMarathi = articleLang === 'mr';

    if (resource.category === 'mental-health') {
      if (isHindi) return ['रोज़ मूड ट्रैक करें', 'किसी भरोसेमंद व्यक्ति से बात करें', 'हेल्थकेयर चेक-इन शेड्यूल करें'];
      if (isMarathi) return ['दररोज मूड नोंदवा', 'विश्वासू व्यक्तीशी बोला', 'हेल्थकेअर चेक-इन ठरवा'];
      return ['Track your mood daily', 'Talk to a trusted person', 'Schedule a provider check-in'];
    }
    if (resource.category === 'breastfeeding') {
      if (isHindi) return ['एक फीडिंग पोज़िशन बदलकर देखें', 'फीड सेशन लॉग करें', 'ज़रूरत पर lactation support लें'];
      if (isMarathi) return ['एक feeding position बदलून पहा', 'feed session नोंदवा', 'गरज वाटल्यास lactation support घ्या'];
      return ['Try one feeding-position adjustment', 'Log feed sessions', 'Contact lactation support if needed'];
    }
    if (resource.category === 'recovery') {
      if (isHindi) return ['आराम करें और पानी पिएं', 'लक्षणों पर नज़र रखें', 'पोस्टपार्टम फॉलो-अप रखें'];
      if (isMarathi) return ['विश्रांती घ्या आणि पाणी प्या', 'लक्षणांवर लक्ष ठेवा', 'पोस्टपार्टम फॉलो-अप चुकवू नका'];
      return ['Rest and hydrate', 'Monitor symptoms', 'Keep postpartum follow-up appointment'];
    }
    if (isHindi) return ['एक व्यावहारिक टिप चुनें', '3-5 दिन लगातार करें', 'प्रगति देखकर सुधार करें'];
    if (isMarathi) return ['एक उपयोगी टिप निवडा', '3-5 दिवस सातत्य ठेवा', 'प्रगतीनुसार बदल करा'];
    return ['Pick one practical tip', 'Use it consistently for 3-5 days', 'Review progress and adjust'];
  };

  const filteredResources = resources.filter(resource => {
    const matchesCategory = selectedCategory === 'all' || resource.category === selectedCategory;
    const matchesSearch = resource.title.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
                         resource.description.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const featuredResources = resources.filter(resource => resource.featured);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Educational Resources</h1>
        <p className="text-gray-600">
          Expert-curated content to support your postpartum journey with evidence-based information.
        </p>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-8">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search resources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-colors"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Filter className="h-5 w-5 text-gray-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-colors"
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Featured Resources */}
      {selectedCategory === 'all' && !searchQuery && (
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">Featured Resources</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {featuredResources.map((resource) => (
              <div
                key={resource.id}
                className="bg-gradient-to-r from-rose-500 to-pink-500 rounded-xl p-6 text-white cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => handleResourceClick(resource)}
              >
                {resource.thumbnail_url && (
                  <img
                    src={resource.thumbnail_url}
                    alt={resource.title}
                    className="w-full h-32 object-cover rounded-lg mb-4 shadow-sm opacity-90"
                    loading="lazy"
                    onError={(e) => {
                      // If external thumbnails can't load, show a local placeholder.
                      (e.currentTarget as HTMLImageElement).src = getFallbackThumbnail(resource.title);
                    }}
                  />
                )}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <div className="bg-white/20 p-2 rounded-lg">
                      {getTypeIcon(resource.type)}
                    </div>
                    <span className="text-sm font-medium capitalize bg-white/20 px-2 py-1 rounded">
                      {resource.type}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Star className="h-4 w-4 fill-current text-yellow-300" />
                    <span className="text-sm">{resource.rating}</span>
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-2">{resource.title}</h3>
                <p className="text-rose-100 mb-4 line-clamp-2">{resource.description}</p>
                <div className="flex items-center justify-between text-sm text-rose-100">
                  <span>{resource.author}</span>
                  <div className="flex items-center space-x-1">
                    <Clock className="h-4 w-4" />
                    <span>{resource.duration}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Pills */}
      <div className="flex flex-wrap gap-2 mb-8">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-full font-medium transition-colors ${
              selectedCategory === category.id
                ? 'bg-rose-500 text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-rose-50 hover:text-rose-600 border border-gray-200'
            }`}
          >
            <category.icon className="h-4 w-4" />
            <span>{category.name}</span>
          </button>
        ))}
      </div>

      {/* Resources Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={`education-skeleton-${idx}`}
              className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 animate-pulse"
            >
              <div className="w-full h-32 rounded-lg bg-gray-200 mb-4" />
              <div className="flex items-center justify-between mb-4">
                <div className="h-6 w-24 rounded-full bg-gray-200" />
                <div className="h-4 w-10 rounded bg-gray-200" />
              </div>
              <div className="h-5 w-3/4 rounded bg-gray-200 mb-2" />
              <div className="h-4 w-full rounded bg-gray-200 mb-2" />
              <div className="h-4 w-5/6 rounded bg-gray-200 mb-4" />
              <div className="flex items-center justify-between">
                <div className="h-4 w-1/3 rounded bg-gray-200" />
                <div className="h-4 w-1/4 rounded bg-gray-200" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredResources.map((resource) => (
          <div
            key={resource.id}
            className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => handleResourceClick(resource)}
          >
            {resource.thumbnail_url && (
              <img
                src={resource.thumbnail_url}
                alt={resource.title}
                className="w-full h-32 object-cover rounded-lg mb-4 shadow-sm"
                loading="lazy"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = getFallbackThumbnail(resource.title);
                }}
              />
            )}
            <div className="flex items-start justify-between mb-4">
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium ${getTypeColor(resource.type)}`}>
                {getTypeIcon(resource.type)}
                <span className="capitalize">{resource.type}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Star className="h-4 w-4 fill-current text-yellow-500" />
                <span className="text-sm font-medium">{resource.rating}</span>
              </div>
            </div>
            
            <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">{resource.title}</h3>
            <p className="text-gray-600 text-sm mb-4 line-clamp-3">{resource.description}</p>
            
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span className="truncate flex-1 mr-2">{resource.author}</span>
              <div className="flex items-center space-x-1 flex-shrink-0">
                <Clock className="h-4 w-4" />
                <span>{resource.duration}</span>
              </div>
            </div>
          </div>
        ))}
        </div>
      )}

      {/* No Results */}
      {!loading && filteredResources.length === 0 && (
        <div className="text-center py-12">
          <Book className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No resources found</h3>
          <p className="text-gray-600">
            Try adjusting your search terms or browse different categories.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
            }}
            className="mt-4 px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg transition-colors text-sm font-medium"
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* Resource Modal */}
      {selectedResource && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-screen overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-100 p-6 rounded-t-xl z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium ${getTypeColor(selectedResource.type)}`}>
                    {getTypeIcon(selectedResource.type)}
                    <span className="capitalize">{selectedResource.type}</span>
                  </div>
                  {typeof selectedResource.rating === 'number' && (
                    <div className="flex items-center space-x-1">
                      <Star className="h-4 w-4 fill-current text-yellow-500" />
                      <span className="text-sm font-medium">{selectedResource.rating}</span>
                    </div>
                  )}
                </div>
                  {selectedResource.type === 'article' && (
                    <select
                      value={articleLang}
                      onChange={(e) => setArticleLang(e.target.value as ArticleLang)}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                    >
                      <option value="en">English</option>
                      <option value="hi">हिन्दी</option>
                      <option value="mr">मराठी</option>
                    </select>
                  )}
                <button
                  onClick={() => {
                    setSelectedResource(null);
                    setFullResource(null);
                    setArticleLang('en');
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {loadingResource ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-rose-500" />
                </div>
              ) : (
                <>
                  {(() => {
                    const resourceToUse = fullResource || selectedResource;
                    return (
                      <>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">{resourceToUse.title}</h2>

                        {resourceToUse.thumbnail_url && (
                          <img
                            src={resourceToUse.thumbnail_url as string}
                            alt={resourceToUse.title}
                            className="w-full h-56 object-cover rounded-lg mb-4"
                            loading="lazy"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = getFallbackThumbnail(
                                resourceToUse.title
                              );
                            }}
                          />
                        )}
                        
                        <div className="flex items-center space-x-4 text-sm text-gray-600 mb-6">
                          {resourceToUse.author && <span>By {resourceToUse.author}</span>}
                          {resourceToUse.duration && (
                            <div className="flex items-center space-x-1">
                              <Clock className="h-4 w-4" />
                              <span>{resourceToUse.duration}</span>
                            </div>
                          )}
                        </div>

                        <div className="prose prose-sm max-w-none mb-6">
                          <p className="text-gray-700 leading-relaxed mb-4">{resourceToUse.description}</p>
                        </div>
                      </>
                    );
                  })()}
                  
                  <div className="prose prose-sm max-w-none mb-6">
                    
                    {/* Video Content */}
                    {selectedResource.type === 'video' && (
                      <div className="mb-6">
                        {(() => {
                          const resourceToUse = fullResource || selectedResource;
                          const videoUrl = getVideoEmbedUrl(resourceToUse.content_url);
                          
                          if (videoUrl) {
                            return (
                              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                                <iframe
                                  src={videoUrl}
                                  className="absolute top-0 left-0 w-full h-full rounded-lg"
                                  frameBorder="0"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                  title={selectedResource.title}
                                />
                              </div>
                            );
                          } else {
                            return (
                              <div className="bg-gray-100 rounded-lg p-8 text-center mb-4">
                                <Play className="h-16 w-16 text-gray-400 mx-auto mb-2" />
                                <p className="text-gray-600">Video URL not available</p>
                                {resourceToUse.content_url && (
                                  <a
                                    href={resourceToUse.content_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-rose-500 hover:text-rose-600 mt-2 inline-block"
                                  >
                                    Open video link
                                  </a>
                                )}
                              </div>
                            );
                          }
                        })()}
                      </div>
                    )}

                    {/* Article Content */}
                    {selectedResource.type === 'article' && (
                      <div className="article-content">
                        {(() => {
                          const resourceToUse = fullResource || selectedResource;
                          const content = resourceToUse.content || resourceToUse.content_url;
                          
                          if (content) {
                            // If content is HTML string, render it
                            if (typeof content === 'string' && content.includes('<')) {
                              const quickTakeaways = getQuickTakeaways(resourceToUse);
                              const nextSteps = getNextSteps(resourceToUse);
                              return (
                                <div 
                                  className="text-gray-700 leading-relaxed space-y-4"
                                >
                                  <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
                                    <h4 className="font-semibold text-rose-900 mb-2">
                                      {articleLang === 'hi'
                                        ? 'मुख्य बातें'
                                        : articleLang === 'mr'
                                        ? 'मुख्य मुद्दे'
                                        : 'Quick Takeaways'}
                                    </h4>
                                    <ul className="list-disc list-inside text-sm text-rose-800 space-y-1">
                                      {quickTakeaways.map((item, idx) => (
                                        <li key={`takeaway-${idx}`}>{item}</li>
                                      ))}
                                    </ul>
                                  </div>
                                  {(resourceToUse.thumbnail_url || selectedResource.thumbnail_url) && (
                                    <img
                                      src={(resourceToUse.thumbnail_url || selectedResource.thumbnail_url) as string}
                                      alt={resourceToUse.title}
                                      className="w-full h-52 object-cover rounded-lg mb-2"
                                      loading="lazy"
                                      onError={(e) => {
                                        (e.currentTarget as HTMLImageElement).src = getFallbackThumbnail(
                                          resourceToUse.title
                                        );
                                      }}
                                    />
                                  )}
                                  <div
                                    dangerouslySetInnerHTML={{ __html: content }}
                                  />
                                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                    <h4 className="font-semibold text-blue-900 mb-2">
                                      {articleLang === 'hi'
                                        ? 'अब आगे क्या करें'
                                        : articleLang === 'mr'
                                        ? 'पुढे काय करावे'
                                        : 'What To Do Next'}
                                    </h4>
                                    <ul className="list-disc list-inside text-sm text-blue-800 space-y-1">
                                      {nextSteps.map((item, idx) => (
                                        <li key={`step-${idx}`}>{item}</li>
                                      ))}
                                    </ul>
                                  </div>
                                  {resourceToUse.category === 'mental-health' && (
                                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                      <p className="text-sm text-red-800">
                                        {articleLang === 'hi'
                                          ? 'यदि आप असुरक्षित या बहुत ज़्यादा परेशान महसूस कर रही हैं, तो तुरंत सहायता के लिए Emergency सेक्शन खोलें।'
                                          : articleLang === 'mr'
                                          ? 'तुम्हाला असुरक्षित किंवा खूप ताण जाणवत असल्यास तात्काळ मदतीसाठी Emergency विभाग उघडा.'
                                          : 'If you feel unsafe or overwhelmed, open the Emergency section for immediate support resources.'}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              );
                            } else if (resourceToUse.content_url) {
                              // If it's a URL, provide a link
                              return (
                                <div>
                                  <p className="mb-4">Read the full article:</p>
                                  <a
                                    href={resourceToUse.content_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-rose-500 hover:text-rose-600 font-medium"
                                  >
                                    Open Article →
                                  </a>
                                </div>
                              );
                            }
                          }
                          
                          // Default article content
                          return (
                            <div>
                              {(resourceToUse.thumbnail_url || '').toString().length > 0 && (
                                <img
                                  src={resourceToUse.thumbnail_url as string}
                                  alt={resourceToUse.title}
                                  className="w-full h-52 object-cover rounded-lg mb-5"
                                  loading="lazy"
                                  onError={(e) => {
                                    (e.currentTarget as HTMLImageElement).src = getFallbackThumbnail(
                                      resourceToUse.title
                                    );
                                  }}
                                />
                              )}
                              <h3 className="text-xl font-semibold mb-3">Key Points Covered:</h3>
                              <ul className="list-disc list-inside space-y-2 text-gray-700">
                                <li>Understanding the symptoms and signs</li>
                                <li>Risk factors and causes</li>
                                <li>Treatment options and support</li>
                                <li>When to seek professional help</li>
                                <li>Self-care strategies</li>
                              </ul>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* Guide Content */}
                    {selectedResource.type === 'guide' && (
                      <div>
                        {(() => {
                          const resourceToUse = fullResource || selectedResource;
                          const content = resourceToUse.content || resourceToUse.content_url;
                          
                          if (content && typeof content === 'string' && content.includes('<')) {
                            return (
                              <div 
                                className="text-gray-700 leading-relaxed space-y-4"
                                dangerouslySetInnerHTML={{ __html: content }}
                              />
                            );
                          } else if (resourceToUse.content_url) {
                            return (
                              <div>
                                <p className="mb-4">Access the full guide:</p>
                                <a
                                  href={resourceToUse.content_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-rose-500 hover:text-rose-600 font-medium"
                                >
                                  Open Guide →
                                </a>
                              </div>
                            );
                          }
                          
                          return (
                            <div>
                              <h3 className="text-xl font-semibold mb-3">This Guide Includes:</h3>
                              <ul className="list-disc list-inside space-y-2 text-gray-700">
                                <li>Week-by-week recovery timeline</li>
                                <li>Physical changes to expect</li>
                                <li>Emotional adjustment periods</li>
                                <li>Warning signs to watch for</li>
                                <li>Healthcare provider contact guidelines</li>
                              </ul>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* Course Content */}
                    {selectedResource.type === 'course' && (
                      <div>
                        {(() => {
                          const resourceToUse = fullResource || selectedResource;
                          const content = resourceToUse.content || resourceToUse.content_url;

                          if (content && typeof content === 'string' && content.includes('<')) {
                            return (
                              <div
                                className="text-gray-700 leading-relaxed space-y-4"
                                dangerouslySetInnerHTML={{ __html: content }}
                              />
                            );
                          } else if (resourceToUse.content_url) {
                            return (
                              <div>
                                <p className="mb-4">Access the full course:</p>
                                <a
                                  href={resourceToUse.content_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-rose-500 hover:text-rose-600 font-medium"
                                >
                                  Open Course →
                                </a>
                              </div>
                            );
                          }

                          return (
                            <div>
                              <h3 className="text-xl font-semibold mb-3">This Course Includes:</h3>
                              <ul className="list-disc list-inside space-y-2 text-gray-700">
                                <li>Structured learning modules</li>
                                <li>Practical postpartum guidance</li>
                                <li>Self-checks and next-step recommendations</li>
                                <li>When to seek professional help</li>
                              </ul>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* Podcast Content */}
                    {selectedResource.type === 'podcast' && (
                      <div>
                        {(() => {
                          const resourceToUse = fullResource || selectedResource;
                          const audioUrl = getAudioUrl(resourceToUse.content_url);
                          const videoEmbedUrl = getVideoEmbedUrl(resourceToUse.content_url);

                          if (audioUrl) {
                            return (
                              <div className="mb-4">
                                <p className="mb-3 text-gray-800 font-medium">Listen to the podcast:</p>
                                <audio controls src={audioUrl} className="w-full" />
                              </div>
                            );
                          }

                          // Many podcast providers (YouTube/Vimeo/Spotify embeds) work via iframe embed URLs.
                          if (videoEmbedUrl) {
                            return (
                              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                                <iframe
                                  src={videoEmbedUrl}
                                  className="absolute top-0 left-0 w-full h-full rounded-lg"
                                  frameBorder="0"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                  title={`${resourceToUse.title} podcast`}
                                />
                              </div>
                            );
                          }

                          if (resourceToUse.content_url) {
                            return (
                              <div>
                                <p className="mb-2 text-gray-700">Listen here:</p>
                                <a
                                  href={resourceToUse.content_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-rose-500 hover:text-rose-600 font-medium"
                                >
                                  Open Podcast Link →
                                </a>
                              </div>
                            );
                          }

                          // If the DB stores embedded HTML content for podcasts, render it.
                          if (
                            resourceToUse.content &&
                            typeof resourceToUse.content === 'string' &&
                            resourceToUse.content.includes('<')
                          ) {
                            return (
                              <div
                                className="text-gray-700 leading-relaxed space-y-4"
                                dangerouslySetInnerHTML={{ __html: resourceToUse.content }}
                              />
                            );
                          }

                          return (
                            <div className="bg-gray-100 rounded-lg p-8 text-center">
                              <Play className="h-16 w-16 text-gray-400 mx-auto mb-2" />
                              <p className="text-gray-600">Podcast content unavailable</p>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Education;