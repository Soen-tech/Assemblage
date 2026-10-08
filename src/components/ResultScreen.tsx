import { motion } from 'framer-motion';
import { Share2, Globe, ShoppingBag, BookOpen } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Whisky } from '../types';
import SWRIChart from './RadarChart';
import { getTextureDetails } from '../lib/textureHelper';

export default function ResultScreen({ whisky, onSave }: { whisky: Whisky; onSave: () => void }) {
  const isWine = whisky.category === 'wine' || whisky.swriProfile?.category === 'wine';
  
  const textureConfig = getTextureDetails(whisky);
  const [imgSrc, setImgSrc] = useState(textureConfig.localPath);

  useEffect(() => {
    const currentConfig = getTextureDetails(whisky);
    setImgSrc(currentConfig.localPath);
  }, [whisky]);
  
  // Dynamically map prominent notes so dry white wine won't show Peat and Seaweed notes!
  const prominentNotes = (whisky.tastingNotes && whisky.tastingNotes.length > 0)
    ? whisky.tastingNotes.slice(0, 3).map((note, idx) => {
        const icons = ['◉', '◌', '⧉', '◈', '✦'];
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
        const lowerNote = note.toLowerCase();
        let desc = isWine 
          ? `A defining and elegant flavor element observed in this fine wine.`
          : `A distinct and defining flavor element observed in this premium expression.`;
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
      })
    : [
        { icon: '◉', label: 'Elegant Balance', desc: 'Strikes a perfect equilibrium of acidity, fruit, and structure.' },
        { icon: '◌', label: 'Aromatic Complexity', desc: 'Complex primary and secondary bouquet notes evolving in glass.' },
        { icon: '⧉', label: 'Memorable Finish', desc: 'Lingering elements that leave a distinct, lasting impression.' }
      ];



  return (
    <div className="flex-1 px-6 pt-6 pb-32">
      <header className="text-center mb-10">
        <span className="text-[10px] font-extrabold text-primary tracking-widest uppercase">
          {isWine ? 'Wine Analysis Complete' : 'Analysis Complete'}
        </span>
        <h2 className="text-3xl font-serif text-white mt-2 mb-2 leading-tight">{whisky.name}</h2>
        <p className="text-sm text-balance text-on-surface-variant max-w-sm mx-auto leading-relaxed italic px-4">
          {whisky.description}
        </p>
      </header>

      <section className="bg-surface-container rounded-3xl border border-white/5 p-6 mb-6">
        <h3 className="text-label-md text-on-surface-variant mb-6 text-center">
          {isWine ? "WINE CHARACTER PROFILE" : "SWRI FLAVOUR PROFILE"}
        </h3>
        <SWRIChart profile={whisky.swriProfile} />
        
        <div className="grid grid-cols-4 gap-2 mt-8 text-center">
          <div>
            <p className="text-lg font-serif text-white">{whisky.swriProfile?.intensity || "--"}</p>
            <p className="text-[8px] text-on-surface/40 font-bold uppercase tracking-widest mt-1">
              {isWine ? "Body" : "Intensity"}
            </p>
          </div>
          <div>
            <p className="text-lg font-serif text-white truncate max-w-[70px] mx-auto" title={whisky.tastingNotes?.[0] || (isWine ? "Classic" : "Smoke")}>
              {whisky.tastingNotes?.[0] || (isWine ? "Classic" : "Smoke")}
            </p>
            <p className="text-[8px] text-on-surface/40 font-bold uppercase tracking-widest mt-1">Dominant</p>
          </div>
          <div>
            <p className="text-lg font-serif text-white">{whisky.age || (isWine ? "Vintage" : "NAS")}</p>
            <p className="text-[8px] text-on-surface/40 font-bold uppercase tracking-widest mt-1">
              {isWine ? "Vintage" : "Maturity"}
            </p>
          </div>
          <div>
            <p className="text-lg font-serif text-white truncate max-w-[70px] mx-auto" title={whisky.region}>{whisky.region}</p>
            <p className="text-[8px] text-on-surface/40 font-bold uppercase tracking-widest mt-1">
              {isWine ? "Appellation" : "Region"}
            </p>
          </div>
        </div>
      </section>

      <div className="space-y-4 mb-8">
        <h3 className="text-label-md text-on-surface-variant ml-2 uppercase tracking-widest">PROMINENT NOTES</h3>
        
        {prominentNotes.map((note, idx) => (
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

      <div className="relative h-48 rounded-3xl overflow-hidden mb-8 border border-white/5 group">
        <img 
          src={imgSrc} 
          onError={() => {
            if (imgSrc !== textureConfig.fallbackUrl) {
              setImgSrc(textureConfig.fallbackUrl);
            }
          }}
          alt="Texture" 
          className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="absolute bottom-6 left-6">
          <p className="text-label-md text-primary mb-1 uppercase tracking-widest">{textureConfig.label}</p>
          <p className="text-lg font-serif">{textureConfig.value}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <button 
          onClick={onSave}
          className="w-full bg-primary text-on-primary h-14 rounded-full font-bold flex items-center justify-center gap-3 active:scale-95 transition-transform"
        >
          <BookOpen size={20} /> SAVE TO JOURNAL
        </button>
        <div className="flex gap-3">
          <button className="flex-1 glass h-12 rounded-full font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-transform">
            <Share2 size={16} /> Share Result
          </button>
          <button className="flex-1 glass h-12 rounded-full font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-transform">
            <ShoppingBag size={16} /> Find a Bottle
          </button>
        </div>
      </div>
    </div>
  );
}
