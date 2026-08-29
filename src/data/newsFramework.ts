// A structured framework for analysing market news — not fabricated headlines.
export const NEWS_ANALYSIS_FRAMEWORK = [
  {
    step: 1,
    title: 'What is the story?',
    prompt: 'State the event in one factual sentence (who/what/when).',
  },
  {
    step: 2,
    title: 'Why does it matter?',
    prompt: 'Which economic mechanism does it touch (growth, inflation, rates, risk appetite, liquidity)?',
  },
  {
    step: 3,
    title: 'Which assets are affected?',
    prompt: 'Map to equities / rates / FX / commodities / credit / vol. Direction of first-order impact?',
  },
  {
    step: 4,
    title: 'What moved?',
    prompt: 'Note the observed reaction (price/yield/curve/vol) and its size vs expectations.',
  },
  {
    step: 5,
    title: 'Possible explanation',
    prompt: 'Form a hypothesis linking the event to the move. Was it expectations vs surprise?',
  },
  {
    step: 6,
    title: 'What to monitor next',
    prompt: 'What upcoming data/events would confirm or refute your thesis?',
  },
];

export const NEWS_BUTTONS = [
  { label: 'Read Bloomberg', url: 'https://www.bloomberg.com/markets' },
  { label: 'Read Reuters', url: 'https://www.reuters.com/markets/' },
  { label: 'Read FT', url: 'https://www.ft.com/markets' },
  { label: 'Read WSJ (NTU)', url: 'https://www.wsj.com/finance' },
  { label: 'Read Business Times (NTU)', url: 'https://www.businesstimes.com.sg/' },
  { label: 'Read CNBC', url: 'https://www.cnbc.com/markets/' },
  { label: 'Check Markets', url: 'https://www.google.com/finance/' },
  { label: 'Economic Calendar', url: 'https://tradingeconomics.com/calendar' },
  { label: 'Fed Releases', url: 'https://www.federalreserve.gov/newsevents.htm' },
];
