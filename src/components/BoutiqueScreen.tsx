import { motion, AnimatePresence } from 'framer-motion';
import { Search, ShoppingBag, Plus, Loader2, X, Share2, Check, Info, ShoppingCart } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import { getBoutiqueItems } from '../services/supabase';
import { BOUTIQUE_ITEMS } from '../constants';
import PayfastCheckoutModal from './PayfastCheckoutModal';

export default function BoutiqueScreen({ clubId }: { clubId?: string | string[] }) {
  const [products, setProducts] = useState<any[]>(BOUTIQUE_ITEMS);
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  const [copiedProductId, setCopiedProductId] = useState<string | null>(null);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const clubIdKey = Array.isArray(clubId) ? clubId.join(',') : (clubId || 'all');
  
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'All' || (p.category && p.category === selectedCategory);
    return matchesSearch && matchesCategory;
  });

  const handleReload = async () => {
    try {
      const { data } = await getBoutiqueItems(clubId);
      if (data) {
        const normalized = data.map(item => ({
          ...item,
          tags: Array.isArray(item.tags) ? item.tags : (item.tags ? [item.tags] : [])
        }));
        setProducts(normalized);
      }
    } catch (error) {
      console.error("Failed to load boutique items:", error);
    }
  };

  useEffect(() => {
    async function loadItems() {
      setLoading(true);
      try {
        const { data } = await getBoutiqueItems(clubId);
        if (data) {
          // Normalize tags if they came back as strings or other formats from DB
          const normalized = data.map(item => ({
            ...item,
            tags: Array.isArray(item.tags) ? item.tags : (item.tags ? [item.tags] : [])
          }));
          setProducts(normalized);
        }
      } catch (error) {
        console.error("Failed to load boutique items:", error);
      } finally {
        setLoading(false);
      }
    }
    loadItems();
  }, [clubIdKey]);

  useEffect(() => {
    const autoOpenId = localStorage.getItem('auto_open_boutique_product_id');
    if (autoOpenId) {
      const found = products.find(p => p.id === autoOpenId);
      if (found) {
        setSelectedProduct(found);
        localStorage.removeItem('auto_open_boutique_product_id');
      } else {
        const fetchProductDirectly = async () => {
          try {
            const { getBoutiqueItem } = await import('../services/supabase');
            const { data } = await getBoutiqueItem(autoOpenId);
            if (data) {
              const packed = {
                ...data,
                tags: Array.isArray(data.tags) ? data.tags : (data.tags ? [data.tags] : [])
              };
              setSelectedProduct(packed);
            }
          } catch (e) {
            console.error("Failed auto-opening boutique item via invite:", e);
          } finally {
            localStorage.removeItem('auto_open_boutique_product_id');
          }
        };
        fetchProductDirectly();
      }
    }
  }, [products]);

  const handleShareBoutiqueItem = async (product: any) => {
    setGeneratingInvite(true);
    try {
      const { generateBoutiqueInviteLink } = await import('../services/supabase');
      const defaultClubId = Array.isArray(clubId) ? clubId[0] : (clubId || 'underground-001');
      const { link } = await generateBoutiqueInviteLink(
        product.id,
        defaultClubId,
        'demo-admin-id',
        50
      );
      if (link) {
        await navigator.clipboard.writeText(link);
        setCopiedProductId(product.id);
        setTimeout(() => setCopiedProductId(null), 3000);
      }
    } catch (e) {
      console.error("Failed to generate boutique item share link:", e);
      alert("Failed to copy share link");
    } finally {
      setGeneratingInvite(false);
    }
  };


  return (
    <div className="flex-1 px-6 pt-6 pb-32">
      <header className="mb-10">
        <span className="text-[10px] font-extrabold text-primary tracking-[0.2em] uppercase mb-2 block">Curated Excellence</span>
        <h2 className="text-4xl font-serif text-white mb-3">The Connoisseur's Selection (COMING SOON)</h2>
        <p className="text-sm text-white/40 leading-relaxed max-w-sm">
          Explore our hand-picked inventory of rare releases and legendary distillates.
        </p>
      </header>

      <div className="flex flex-col gap-4 mb-8">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={18} />
          <input 
            type="text" 
            placeholder="Search our vault..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface-container h-12 pl-12 pr-4 rounded-xl border border-white/5 outline-none focus:border-primary/50"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {["All", "Whisky", "Casks", "Access", "Wines"].map((cat) => (
            <button 
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold border transition-colors",
                selectedCategory === cat 
                  ? "bg-primary/20 border-primary text-primary" 
                  : "bg-white/5 border-white/5 text-on-surface/40"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="animate-spin text-primary" />
            <p className="text-xs text-white/40 uppercase tracking-widest">Opening the Vault...</p>
          </div>
        ) : filteredProducts.length > 0 ? (
          filteredProducts.map((product) => (
            <motion.div 
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedProduct(product)}
              className="group relative bg-surface-container rounded-3xl overflow-hidden border border-white/5 cursor-pointer"
            >
              <div className="aspect-square relative overflow-hidden">
                <img 
                  src={product.image} 
                  alt={product.name} 
                  className="w-full h-full object-cover group-hover:rotate-1 group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10">
                  <span className="text-xs font-bold text-secondary">{product.price}</span>
                </div>
              </div>
              <div className="p-6">
                <p className="text-[10px] font-semibold text-primary/60 uppercase tracking-widest mb-0.5">Exclusive Release</p>
                <h3 className="text-headline-md group-hover:text-primary transition-colors leading-tight mb-2">
                  {product.name}
                </h3>
                
                <p className="text-sm text-on-surface-variant line-clamp-2 mb-4 leading-relaxed italic opacity-80 whitespace-pre-line">
                  {product.description || product.desc || "Limited allocation bottled exclusively for club members."}
                </p>
 
                <div className="flex items-center justify-between gap-4">
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                    {product.price} • {product.category || "Limited Edition"}
                  </p>
                  <div className="flex gap-2 overflow-hidden">
                    {(Array.isArray(product.tags) ? product.tags : []).slice(0, 2).map((tag: string) => (
                      <span key={tag} className="text-[8px] font-bold px-2 py-1 rounded-md bg-white/5 border border-white/10 text-on-surface/30 tracking-widest uppercase whitespace-nowrap">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <ShoppingBag className="text-white/10 mb-4" size={48} />
            <p className="text-white/40 italic">No items currently available in the boutique.</p>
          </div>
        )}
      </div>

      {/* Product Detail Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProduct(null)}
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
                  src={selectedProduct.image || undefined} 
                  alt="" 
                  className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-30" 
                />
                {/* Full Image */}
                <img 
                  src={selectedProduct.image || undefined} 
                  alt={selectedProduct.name} 
                  className="relative w-full h-full object-contain" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface-container via-transparent to-transparent opacity-60" />
                
                <button 
                  onClick={() => setSelectedProduct(null)}
                  className="absolute top-6 right-6 w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 text-white z-10 hover:bg-black/60 transition-colors"
                >
                  <X size={20} />
                </button>
                <div className="absolute top-6 left-6 flex gap-2">
                  <span className="px-3 py-1 bg-primary text-on-primary rounded-full text-[10px] font-bold uppercase tracking-widest">
                    {selectedProduct.category || "Rare Vault"}
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 pt-4">
                <h3 className="font-serif text-3xl text-white mb-6">
                  {selectedProduct.name}
                </h3>

                <div className="flex gap-2 mb-8">
                  {(Array.isArray(selectedProduct.tags) ? selectedProduct.tags : []).map((tag: string) => (
                    <span key={tag} className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-secondary tracking-widest uppercase">
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="space-y-6">
                  <div>
                    <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-3">Item Description</h4>
                    <p className="text-sm text-on-surface-variant leading-relaxed whitespace-pre-line">
                      {selectedProduct.description || "This exceptional release represents the pinnacle of craftsmanship. Matured in hand-selected casks to ensure a profile of unmatched depth and sophistication."}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                      <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1 text-center">Availability</p>
                      <p className="text-sm text-white font-medium text-center">Limited Edition</p>
                    </div>
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                      <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1 text-center">Authenticity</p>
                      <p className="text-sm text-white font-medium text-center">Certificate Included</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-surface-container border-t border-white/10 flex items-center justify-between gap-6">
                <div>
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest leading-none mb-1">Pricing</p>
                  <p className="text-2xl font-serif text-white leading-none">
                    {selectedProduct.payfast_price ? `R ${(Number(selectedProduct.payfast_price) || 0).toFixed(2)}` : (selectedProduct.price || 'Priceless')}
                  </p>
                  {selectedProduct.payfast_quantity !== undefined && selectedProduct.payfast_quantity !== null && (
                    <span className="text-[9px] text-primary block mt-1 font-mono uppercase tracking-wider">
                      {Number(selectedProduct.payfast_quantity) > 0 ? `${selectedProduct.payfast_quantity} units available` : 'SOLD OUT'}
                    </span>
                  )}
                </div>
                <button 
                  onClick={() => setIsCheckoutOpen(true)}
                  disabled={selectedProduct.payfast_quantity !== undefined && selectedProduct.payfast_quantity !== null && Number(selectedProduct.payfast_quantity) <= 0}
                  className="flex-1 bg-primary text-on-primary h-14 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-xl shadow-primary/10 disabled:opacity-40 disabled:scale-100 disabled:shadow-none"
                >
                  <ShoppingCart size={20} />
                  BUY
                </button>
                <button 
                  onClick={() => handleShareBoutiqueItem(selectedProduct)}
                  disabled={generatingInvite}
                  className="w-14 h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-white/100 hover:bg-white/10 hover:border-white/20 transition-all disabled:opacity-40"
                  title="Copy Share Link"
                >
                  {generatingInvite ? (
                    <Loader2 size={20} className="animate-spin text-primary" />
                  ) : copiedProductId === selectedProduct.id ? (
                    <Check size={20} className="text-emerald-400" />
                  ) : (
                    <Share2 size={20} />
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <PayfastCheckoutModal 
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        item={selectedProduct}
        itemType="boutique"
        onSuccess={(updatedVal) => {
          setIsCheckoutOpen(false);
          setSelectedProduct(null);
          handleReload();
        }}
      />
    </div>
  );
}
