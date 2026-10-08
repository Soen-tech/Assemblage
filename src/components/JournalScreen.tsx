import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, Star, X, Share2, MapPin, Calendar, ArrowUpRight, ShieldCheck, Info, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Whisky } from '../types';
import RadarChart from './RadarChart';
import { getTextureDetails } from '../lib/textureHelper';

const getDominantFlavour = (profile: Whisky['swriProfile']) => {
  if (!profile) return 'Complex';
  const isWine = profile.category === 'wine';
  const keys: Array<keyof typeof profile> = ['peaty', 'fruity', 'floral', 'cereal'];
  let maxKey = 'peaty';
  let maxVal = -1;
  for (const key of keys) {
    const val = Number(profile[key]) || 0;
    if (val > maxVal) {
      maxVal = val;
      maxKey = key;
    }
  }

  if (isWine) {
    const wineMap: Record<string, string> = {
      peaty: 'Sweet/Dessert',
      fruity: 'Fruit-Forward',
      floral: 'Crisp/Acidic',
      cereal: 'Bold Tannins'
    };
    return wineMap[maxKey] || 'Complex';
  }

  const map: Record<string, string> = {
    peaty: 'Peaty/Smoke',
    fruity: 'Fruit/Sweet',
    floral: 'Floral/Fresh',
    cereal: 'Cereal/Malt'
  };
  return map[maxKey] || 'Complex';
};

const getProminentNotes = (whisky: Whisky) => {
  const isWine = whisky.category === 'wine' || whisky.swriProfile?.category === 'wine';
  if (whisky.tastingNotes && whisky.tastingNotes.length > 0) {
    const icons = ['◉', '◌', '⧉', '◈', '✦', '❀', '⊚'];
    return whisky.tastingNotes.slice(0, 3).map((note, idx) => {
      const lowerNote = note.toLowerCase();
      let desc = isWine 
        ? `Primary and elegant flavor element identified in this fine wine.`
        : `A distinct and defining flavor element observed in this premium expression.`;
      const descriptions: Record<string, string> = {
        'oak': 'Influenced by maturation in high-grade wooden casks, conveying complex structure.',
        'vanilla': 'Warm, sweet oak-driven aromatics.',
        'peat': 'Peated organic kiln smoke, offering earthy and medicinal highlights.',
        'smoke': 'A pleasant toastiness and char background.',
        'fruit': 'Bright fruit expression, ranging from citrus and orchard fruits to rich berries.',
        'citrus': 'Tangy lemon, lime, or orange peel freshness.',
        'cherry': 'Succulent dark cherry, stone fruits, and red berry details.',
        'honey': 'Rich natural sweetness with a smooth texture.',
        'tannin': 'Fine phenolics offering robust structural dryness and persistence.',
        'spice': 'Pleasing warmth of baking spices or crushed peppercorn.'
      };
      for (const key of Object.keys(descriptions)) {
        if (lowerNote.includes(key)) {
          desc = descriptions[key];
          break;
        }
      }
      return {
        icon: icons[idx % icons.length],
        label: note,
        desc: desc
      };
    });
  }

  const profile = whisky.swriProfile;
  if (!profile) {
    return [
      { icon: '◉', label: 'Malted Barley', desc: 'Rich toasted grains with subtle underlying sweetness.' },
      { icon: '◌', label: 'Warm Oak', desc: 'A woody, structured frame with hints of soft baking spices.' },
      { icon: '⧉', label: 'Balanced Sweetness', desc: 'Soft caramel and gentle fruitiness throughout.' }
    ];
  }

  const notes = [];
  
  // Peaty/Smoke
  if (profile.peaty >= 6) {
    notes.push({ icon: '◉', label: 'Heavy Peat & Smoke', desc: 'Smoky, medicinal, and intense maritime iodine notes.' });
    notes.push({ icon: '◌', label: 'Dried Seaweed', desc: 'A salty tang with hints of coastal air and kelp.' });
  } else if (profile.peaty >= 3) {
    notes.push({ icon: '◉', label: 'Gentle Woodsmoke', desc: 'Soft lingering campfire and aromatic curls of sweet smoke.' });
  }

  // Fruity/Sherry
  if (profile.fruity >= 6) {
    notes.push({ icon: '⧉', label: 'Rich Sherry Oak', desc: 'Deep layers of stewed raisins, dark cherries, and plum syrup.' });
    notes.push({ icon: '✦', label: 'Citrus Zest', desc: 'Tangy orange marmalade and candied lemon peels.' });
  } else if (profile.fruity >= 3) {
    notes.push({ icon: '⧉', label: 'Orchard Fruits', desc: 'Crisp green apple and soft pear vibes.' });
  }

  // Floral
  if (profile.floral >= 5) {
    notes.push({ icon: '❀', label: 'Fresh Heather', desc: 'Delicate floral perfume with honeyed meadows and soft herbs.' });
  }

  // Cereal
  if (profile.cereal >= 5) {
    notes.push({ icon: '⊚', label: 'Toasted Malt', desc: 'Warm artisanal bread, barley field, and toasted oats.' });
  }

  // Add fillers if not enough notes to reach 3
  if (notes.length < 3) {
    notes.push({ icon: '♢', label: 'Vanilla Custard', desc: 'Creamy Madagascar vanilla beans and silky crème brûlée.' });
  }
  if (notes.length < 3) {
    notes.push({ icon: '🪵', label: 'Toasted Oak', desc: 'Well-seasoned American oak barrels with soft spice.' });
  }

  return notes.slice(0, 3);
};

export default function JournalScreen({ 
  entries = [], 
  onDeleteEntry,
  onUpdateEntry
}: { 
  entries?: Whisky[]; 
  onDeleteEntry?: (id: string) => Promise<void>;
  onUpdateEntry?: (entry: Whisky) => Promise<void>;
}) {
  const [search, setSearch] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<Whisky | null>(null);
  
  const [editingRatingsEntry, setEditingRatingsEntry] = useState<Whisky | null>(null);
  const [tempTaste, setTempTaste] = useState(5);
  const [tempAroma, setTempAroma] = useState(5);
  const [tempValue, setTempValue] = useState(5);

  const [journalTextureImg, setJournalTextureImg] = useState<string>('');

  useEffect(() => {
    if (selectedEntry) {
      const config = getTextureDetails(selectedEntry);
      setJournalTextureImg(config.localPath);
    }
  }, [selectedEntry]);
  
  const filteredEntries = entries.filter(entry => 
    entry.name.toLowerCase().includes(search.toLowerCase()) || 
    entry.distillery.toLowerCase().includes(search.toLowerCase()) ||
    entry.region?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 px-6 pt-6 pb-32">
      <header className="mb-8">
        <h2 className="text-headline-lg mb-2">Tasting Journal</h2>
        <p className="text-sm text-on-surface-variant leading-relaxed">
          A curated archive of your olfactory and gustatory journeys through the world's finest distillations.
        </p>
      </header>

      <div className="flex flex-col gap-4 mb-8">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={18} />
          <input 
            type="text" 
            placeholder="Search by distillery or region..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface-container h-12 pl-12 pr-4 rounded-xl border border-white/5 focus:border-primary/50 outline-none transition-colors"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button className="flex-shrink-0 flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full text-xs font-bold">
            <Filter size={14} /> Filter
          </button>
          <button className="flex-shrink-0 bg-primary/10 border border-primary/20 text-primary px-4 py-2 rounded-full text-xs font-bold">
            Single Malt
          </button>
          <button className="flex-shrink-0 bg-white/5 border border-white/10 px-4 py-2 rounded-full text-xs font-bold">
            Peated
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {filteredEntries.map((entry) => (
          <JournalEntry 
            key={entry.id} 
            entry={entry} 
            onClick={() => setSelectedEntry(entry)}
          />
        ))}
        {filteredEntries.length === 0 && (
          <div className="text-center py-12">
            <p className="text-on-surface-variant opacity-60">No entries found matching your search.</p>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedEntry && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedEntry(null)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-x-4 top-[5%] bottom-[5%] bg-surface-container rounded-[2rem] border border-white/10 z-[101] overflow-hidden flex flex-col max-w-2xl mx-auto"
            >
              <div className="relative h-[260px] flex-shrink-0 bg-black/40">
                {/* Blurred Background */}
                <img 
                  src={selectedEntry.image || undefined} 
                  alt="" 
                  className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-30" 
                />
                {/* Full Image */}
                <img 
                  src={selectedEntry.image || undefined} 
                  alt={selectedEntry.name} 
                  className="relative w-full h-full object-contain" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface-container via-transparent to-transparent opacity-60" />
                
                <div className="absolute top-6 right-6 flex items-center gap-2 z-10">
                  <button 
                    onClick={() => setSelectedEntry(null)}
                    className="w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 text-white hover:bg-black/60 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
                
                <div className="absolute bottom-6 right-6 z-10">
                  <button 
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (window.confirm("Are you sure you want to delete this journal entry?")) {
                        if (onDeleteEntry) {
                          await onDeleteEntry(selectedEntry.id);
                        }
                        setSelectedEntry(null);
                      }
                    }}
                    className="w-10 h-10 bg-red-500/20 backdrop-blur-md hover:bg-red-500/40 text-red-400 border border-red-500/20 active:scale-[0.95] rounded-full flex items-center justify-center transition-all flex-shrink-0"
                    title="Delete Entry"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="absolute top-6 left-6 flex gap-2 z-10">
                  <span className="px-3 py-1 bg-primary text-on-primary rounded-full text-[10px] font-bold uppercase tracking-widest">
                    Add Rating
                  </span>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      const currentTaste = selectedEntry.tasteRating ?? selectedEntry.rating ?? 5;
                      const currentAroma = selectedEntry.aromaRating ?? selectedEntry.rating ?? 5;
                      const currentValue = selectedEntry.valueRating ?? selectedEntry.rating ?? 5;
                      setEditingRatingsEntry(selectedEntry);
                      setTempTaste(currentTaste);
                      setTempAroma(currentAroma);
                      setTempValue(currentValue);
                    }}
                    className="px-3 py-1 bg-black/45 hover:bg-black/60 backdrop-blur-md border border-white/10 rounded-full text-[10px] font-bold text-secondary uppercase tracking-widest flex items-center gap-1 cursor-pointer transition-all hover:scale-105 active:scale-95"
                    title="Click to edit dimension ratings"
                  >
                    <Star size={10} className="fill-secondary" /> {(((selectedEntry.tasteRating ?? selectedEntry.rating ?? 5) + (selectedEntry.aromaRating ?? selectedEntry.rating ?? 5) + (selectedEntry.valueRating ?? selectedEntry.rating ?? 5)) / 3).toFixed(1)}
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 pt-4">
                <div className="mb-6">
                  <p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-1">{selectedEntry.distillery}</p>
                  <h3 className="font-serif text-3xl text-white">
                    {selectedEntry.name}
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                    <Calendar className="text-secondary mb-2" size={18} />
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-0.5">Tasted On</p>
                    <p className="text-sm text-white font-medium">{selectedEntry.date}</p>
                  </div>
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                    <MapPin className="text-secondary mb-2" size={18} />
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-0.5">Origin</p>
                    <p className="text-sm text-white font-medium">{selectedEntry.region || "Highlands"}</p>
                  </div>
                </div>

                {selectedEntry.swriProfile && (
                  <div className="mb-10">
                    <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Info size={12} /> Flavour Architecture
                    </h4>
                    <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                      <div className="h-64 flex items-center justify-center mb-6">
                        <RadarChart profile={selectedEntry.swriProfile} />
                      </div>
                      
                      {/* Metric Grid like ResultScreen */}
                      <div className="grid grid-cols-4 gap-2 border-t border-white/10 pt-6 text-center">
                        <div>
                          <p className="text-lg font-serif text-white">{selectedEntry.swriProfile?.intensity || "--"}</p>
                          <p className="text-[8px] text-on-surface/40 font-bold uppercase tracking-widest mt-1">Intensity</p>
                        </div>
                        <div>
                          <p className="text-lg font-serif text-white">{getDominantFlavour(selectedEntry.swriProfile)}</p>
                          <p className="text-[8px] text-on-surface/40 font-bold uppercase tracking-widest mt-1">Dominant</p>
                        </div>
                        <div>
                          <p className="text-lg font-serif text-white">{selectedEntry.age || "NAS"}</p>
                          <p className="text-[8px] text-on-surface/40 font-bold uppercase tracking-widest mt-1">Maturity</p>
                        </div>
                        <div>
                          <p className="text-lg font-serif text-white">{selectedEntry.abv || "--"}</p>
                          <p className="text-[8px] text-on-surface/40 font-bold uppercase tracking-widest mt-1">ABV</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-8">
                  <div>
                    <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-3">Tasting Notes</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedEntry.tastingNotes.map((note) => (
                        <span key={note} className="px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-xl text-xs font-medium">
                          {note}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Prominent Notes like ResultScreen */}
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Prominent Notes</h4>
                    <div className="space-y-3">
                      {getProminentNotes(selectedEntry).map((note, idx) => (
                        <div key={idx} className="bg-white/5 border border-white/5 p-4 rounded-2xl flex gap-4">
                          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-xl flex-shrink-0">
                            {note.icon}
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-white mb-1 tracking-tight">{note.label}</h4>
                            <p className="text-xs text-on-surface-variant leading-relaxed">{note.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Texture Analysis like ResultScreen */}
                  {selectedEntry && (() => {
                    const textureDetails = getTextureDetails(selectedEntry);
                    return (
                      <div>
                        <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-3">{textureDetails.label}</h4>
                        <div className="relative h-32 rounded-3xl overflow-hidden border border-white/5 group">
                          <img 
                            src={journalTextureImg} 
                            onError={() => {
                              if (journalTextureImg !== textureDetails.fallbackUrl) {
                                setJournalTextureImg(textureDetails.fallbackUrl);
                              }
                            }}
                            alt="Texture" 
                            className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                          <div className="absolute bottom-4 left-6">
                            <p className="text-[8px] font-bold text-primary tracking-widest uppercase mb-0.5">Mouthfeel & Body</p>
                            <p className="text-md font-serif text-white">
                              {textureDetails.value}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Rating Dimensions Panel */}
                  <div className="p-5 bg-white/5 rounded-3xl border border-white/5 space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Tasting Dimensions</h4>
                      <button 
                        onClick={() => {
                          const currentTaste = selectedEntry.tasteRating ?? selectedEntry.rating ?? 5;
                          const currentAroma = selectedEntry.aromaRating ?? selectedEntry.rating ?? 5;
                          const currentValue = selectedEntry.valueRating ?? selectedEntry.rating ?? 5;
                          setEditingRatingsEntry(selectedEntry);
                          setTempTaste(currentTaste);
                          setTempAroma(currentAroma);
                          setTempValue(currentValue);
                        }}
                        className="text-[10px] font-bold text-primary hover:underline cursor-pointer transition-all"
                      >
                        Adjust dimensions
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-black/20 p-4 rounded-2xl border border-white/5 text-center">
                        <p className="text-[9px] text-white/40 font-bold uppercase tracking-widest mb-1.5">Taste</p>
                        <div className="flex justify-center gap-0.5 mb-1.5">
                          {[...Array(5)].map((_, i) => (
                            <Star 
                              key={i} 
                              size={10} 
                              className={i < (selectedEntry.tasteRating ?? selectedEntry.rating ?? 5) ? "fill-primary text-primary" : "text-white/10"} 
                            />
                          ))}
                        </div>
                        <p className="text-xs font-mono font-bold text-white">{(selectedEntry.tasteRating ?? selectedEntry.rating ?? 5)}/5</p>
                      </div>
                      <div className="bg-black/20 p-4 rounded-2xl border border-white/5 text-center">
                        <p className="text-[9px] text-white/40 font-bold uppercase tracking-widest mb-1.5">Aroma</p>
                        <div className="flex justify-center gap-0.5 mb-1.5">
                          {[...Array(5)].map((_, i) => (
                            <Star 
                              key={i} 
                              size={10} 
                              className={i < (selectedEntry.aromaRating ?? selectedEntry.rating ?? 5) ? "fill-primary text-primary" : "text-white/10"} 
                            />
                          ))}
                        </div>
                        <p className="text-xs font-mono font-bold text-white">{(selectedEntry.aromaRating ?? selectedEntry.rating ?? 5)}/5</p>
                      </div>
                      <div className="bg-black/20 p-4 rounded-2xl border border-white/5 text-center">
                        <p className="text-[9px] text-white/40 font-bold uppercase tracking-widest mb-1.5">Value</p>
                        <div className="flex justify-center gap-0.5 mb-1.5">
                          {[...Array(5)].map((_, i) => (
                            <Star 
                              key={i} 
                              size={10} 
                              className={i < (selectedEntry.valueRating ?? selectedEntry.rating ?? 5) ? "fill-primary text-primary" : "text-white/10"} 
                            />
                          ))}
                        </div>
                        <p className="text-xs font-mono font-bold text-white">{(selectedEntry.valueRating ?? selectedEntry.rating ?? 5)}/5</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-3">Your Review</h4>
                    <p className="text-sm text-on-surface-variant leading-relaxed whitespace-pre-line">
                      {selectedEntry.description}
                    </p>
                  </div>
                </div>
              </div>

            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 3D Dimensional Rating Editor Modal */}
      <AnimatePresence>
        {editingRatingsEntry && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingRatingsEntry(null)}
              className="fixed inset-0 bg-black/95 backdrop-blur-md z-[110]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-md bg-surface-container rounded-[2rem] border border-white/10 z-[111] overflow-hidden p-6 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h4 className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-1">Tasting Metrics</h4>
                  <h3 className="font-serif text-xl text-white">Rate Whisky</h3>
                </div>
                <button 
                  type="button"
                  onClick={() => setEditingRatingsEntry(null)}
                  className="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center border border-white/15 text-white/60 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <p className="text-xs text-on-surface-variant mb-6 leading-relaxed">
                Adjust each dimensional criterion to calibrate the complete flavor profile evaluation for <span className="text-white font-medium">{editingRatingsEntry.name}</span>.
              </p>

              <div className="space-y-6 mb-8">
                {/* Taste Rating */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-white tracking-wide">Taste</span>
                    <span className="text-xs font-mono text-primary font-bold">{tempTaste}/5</span>
                  </div>
                  <div className="flex gap-2 justify-between bg-black/20 p-3 rounded-2xl border border-white/5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        type="button"
                        key={star}
                        onClick={() => setTempTaste(star)}
                        className="p-1 hover:scale-110 active:scale-95 transition-transform"
                      >
                        <Star 
                          size={24} 
                          className={star <= tempTaste ? "fill-primary text-primary" : "text-white/10 hover:text-white/30"} 
                        />
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-on-surface-variant/60 italic leading-relaxed">
                    Flavor development, complexity, initial palate, and subsequent finish.
                  </p>
                </div>

                {/* Aroma Rating */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-white tracking-wide">Aroma (Nose)</span>
                    <span className="text-xs font-mono text-primary font-bold">{tempAroma}/5</span>
                  </div>
                  <div className="flex gap-2 justify-between bg-black/20 p-3 rounded-2xl border border-white/5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        type="button"
                        key={star}
                        onClick={() => setTempAroma(star)}
                        className="p-1 hover:scale-110 active:scale-95 transition-transform"
                      >
                        <Star 
                          size={24} 
                          className={star <= tempAroma ? "fill-primary text-primary" : "text-white/10 hover:text-white/30"} 
                        />
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-on-surface-variant/60 italic leading-relaxed">
                    Nesting complexity, strength of scent, peat curls, floral and cereal notes.
                  </p>
                </div>

                {/* Value Rating */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-white tracking-wide">Value</span>
                    <span className="text-xs font-mono text-primary font-bold">{tempValue}/5</span>
                  </div>
                  <div className="flex gap-2 justify-between bg-black/20 p-3 rounded-2xl border border-white/5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        type="button"
                        key={star}
                        onClick={() => setTempValue(star)}
                        className="p-1 hover:scale-110 active:scale-95 transition-transform"
                      >
                        <Star 
                          size={24} 
                          className={star <= tempValue ? "fill-primary text-primary" : "text-white/10 hover:text-white/30"} 
                        />
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-on-surface-variant/60 italic leading-relaxed">
                    Market affordability relative to age statement, distillery prestige, and quality.
                  </p>
                </div>
              </div>

              {/* Dynamic Realtime Average Preview */}
              <div className="bg-primary/5 p-4 rounded-2xl border border-primary/20 flex justify-between items-center mb-6">
                <span className="text-xs font-bold text-white/80 uppercase tracking-wider">Calibrated Average:</span>
                <div className="flex items-center gap-1.5">
                  <Star size={16} className="fill-secondary text-secondary" />
                  <span className="text-lg font-mono font-bold text-secondary">
                    {((tempTaste + tempAroma + tempValue) / 3).toFixed(1)}
                  </span>
                  <span className="text-xs text-white/40">/ 5.0</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingRatingsEntry(null)}
                  className="flex-1 h-12 rounded-xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const avg = (tempTaste + tempAroma + tempValue) / 3;
                    const updated: Whisky = {
                      ...editingRatingsEntry,
                      tasteRating: tempTaste,
                      aromaRating: tempAroma,
                      valueRating: tempValue,
                      rating: Math.round(avg)
                    };
                    
                    if (onUpdateEntry) {
                      await onUpdateEntry(updated);
                    }
                    
                    setSelectedEntry(updated);
                    setEditingRatingsEntry(null);
                  }}
                  className="flex-1 h-12 rounded-xl bg-primary text-black font-bold hover:brightness-110 transition-colors cursor-pointer"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function JournalEntry({ entry, onClick }: { entry: Whisky; onClick?: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="bg-surface-container rounded-3xl overflow-hidden border border-white/5 cursor-pointer group"
    >
      <div className="h-48 relative overflow-hidden">
        <img 
          src={entry.image || undefined} 
          alt={entry.name} 
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-surface-container to-transparent opacity-60" />
        <div className="absolute top-4 left-4 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
          <span className="text-[10px] font-bold text-white tracking-widest uppercase">{entry.date}</span>
        </div>
      </div>
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-[10px] font-semibold text-primary/60 uppercase tracking-widest mb-0.5">{entry.distillery}</p>
            <h3 className="text-headline-md group-hover:text-primary transition-colors">{entry.name}</h3>
          </div>
          {(() => {
            const taste = entry.tasteRating ?? entry.rating ?? 5;
            const aroma = entry.aromaRating ?? entry.rating ?? 5;
            const value = entry.valueRating ?? entry.rating ?? 5;
            const avgRating = (taste + aroma + value) / 3;
            const roundedAvg = Math.round(avgRating);
            return (
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star 
                      key={i} 
                      size={14} 
                      className={i < roundedAvg ? "fill-secondary text-secondary" : "text-white/20"} 
                    />
                  ))}
                </div>
                <span className="text-xs font-mono font-bold text-secondary bg-secondary/10 px-1.5 py-0.5 rounded-md">{avgRating.toFixed(1)}</span>
              </div>
            );
          })()}
        </div>
        
        <p className="text-sm text-on-surface-variant line-clamp-2 mb-4 leading-relaxed italic opacity-80 whitespace-pre-line">
          {entry.description}
        </p>

        <div className="flex flex-wrap gap-2">
          {entry.tastingNotes.slice(0, 3).map((note) => (
            <span key={note} className="text-[10px] font-bold px-3 py-1 rounded-full bg-white/5 border border-white/10 text-on-surface/40 uppercase tracking-wider">
              {note}
            </span>
          ))}
          {entry.tastingNotes.length > 3 && (
            <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-white/5 border border-white/10 text-on-surface/40">
              +{entry.tastingNotes.length - 3}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
