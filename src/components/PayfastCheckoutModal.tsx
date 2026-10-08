import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldCheck, CreditCard, Landmark, Loader2, ArrowRight, Printer, AlertTriangle, CheckCircle2, Lock, Tag } from 'lucide-react';
import { useState, useEffect } from 'react';
import { buyPayfastItem, getClubById, createPayfastOrder, supabase, validatePromoCode } from '../services/supabase';

interface PayfastCheckoutProps {
  isOpen: boolean;
  onClose: () => void;
  item: any;
  itemType: 'event' | 'boutique' | 'subscription' | 'club_membership';
  onSuccess: (updatedItem: any) => void;
  userEmail?: string;
}

export default function PayfastCheckoutModal({
  isOpen,
  onClose,
  item,
  itemType,
  onSuccess,
  userEmail = 'connoisseur@proof.club'
}: PayfastCheckoutProps) {
  const [step, setStep] = useState<'options' | 'card' | 'eft' | 'processing' | 'success' | 'error'>('options');
  const [quantity, setQuantity] = useState<number>(1);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'eft'>('card');
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  // Simulated Form Inputs
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState('');
  const [selectedBank, setSelectedBank] = useState('');
  const [accountNumber, setAccountNumber] = useState('');

  // Transaction Receipt Token
  const [receiptToken, setReceiptToken] = useState<any>(null);

  // Loaded Club Info
  const [clubInfo, setClubInfo] = useState<any>(null);
  const [loadingClub, setLoadingClub] = useState(false);

  useEffect(() => {
    if (isOpen && item?.club_id) {
      setLoadingClub(true);
      getClubById(item.club_id)
        .then(res => {
          if (res?.data) {
            setClubInfo(res.data);
          }
          setLoadingClub(false);
        })
        .catch(err => {
          console.error("[PayfastCheckout] Error loading club info:", err);
          setLoadingClub(false);
        });
    } else {
      setClubInfo(null);
    }
  }, [isOpen, item?.club_id]);

  // Dynamic authenticated database user tracking for order registration
  const [dbUser, setDbUser] = useState<any>(null);

  // Promo Code States
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<any>(null);
  const [promoError, setPromoError] = useState('');
  const [validatingPromo, setValidatingPromo] = useState(false);

  useEffect(() => {
    if (isOpen && supabase) {
      supabase.auth.getUser()
        .then(({ data }) => {
          if (data?.user) {
            setDbUser(data.user);
            console.log("[PayfastCheckout] Authenticated buyer profile retrieved:", data.user.email);
          }
        })
        .catch(err => {
          console.error("[PayfastCheckout] Error looking up auth user:", err);
        });
    } else if (!isOpen) {
      setDbUser(null);
      setStep('options');
      setQuantity(1);
      setErrorMessage('');
      setReceiptToken(null);
      setAppliedPromo(null);
      setPromoCodeInput('');
      setPromoError('');
    }
  }, [isOpen]);

  if (!isOpen || !item) return null;

  // Payfast variables
  const pfPriceZar = Number(item.payfast_price) || Number(item.price) || 0;
  const availableStock = item.payfast_quantity !== null && item.payfast_quantity !== undefined ? Number(item.payfast_quantity) : null;
  const isSoldOut = availableStock !== null && availableStock <= 0;
  
  const subtotalAmount = pfPriceZar * quantity;

  // Dynamically compute discount based on subtotal and applied promo code
  let discountAmount = 0;
  if (appliedPromo) {
    const minOrder = parseFloat(String(appliedPromo.min_order_amount)) || 0;
    const discountVal = parseFloat(String(appliedPromo.discount_value)) || 0;

    if (minOrder <= 0 || subtotalAmount >= minOrder) {
      if (appliedPromo.discount_type === 'percent') {
        discountAmount = Math.round((subtotalAmount * (discountVal / 100)) * 100) / 100;
      } else {
        discountAmount = Math.min(subtotalAmount, discountVal);
      }
    }
  }

  const totalAmount = Math.max(0, subtotalAmount - discountAmount);

  const handleApplyPromo = async () => {
    if (!promoCodeInput.trim()) return;
    setValidatingPromo(true);
    setPromoError('');
    try {
      const { data, valid, discountApplied, error } = await validatePromoCode(promoCodeInput.trim(), subtotalAmount);
      if (error || !valid) throw error || new Error('Invalid promo code');
      if (data) {
        setAppliedPromo(data);
        setPromoCodeInput('');
      }
    } catch (err: any) {
      setPromoError(err.message || 'Invalid promo code');
      setAppliedPromo(null);
    } finally {
      setValidatingPromo(false);
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoError('');
  };

  // 1. Process standard external Payfast redirection
  const handlePayfastRedirect = async () => {
    try {
      // Validate supply
      if (availableStock !== null && availableStock < quantity) {
        setErrorMessage(`Requested quantity exceeds available capacity (${availableStock} remaining)`);
        setStep('error');
        return;
      }

      setStep('processing');

      // Attempt server checkout re-validation for server-enforced amount
      let checkoutPayload: any = null;
      try {
        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: appliedPromo?.code,
            promo: appliedPromo,
            orderTotal: subtotalAmount,
            userId: dbUser?.id || 'demo-user-id',
            item,
            itemType,
            quantity,
            userEmail,
            clubMerchantId: clubInfo?.payfast_merchant_id || ''
          })
        });
        const checkoutRes = await res.json();
        if (res.ok && checkoutRes.success && checkoutRes.payfastData) {
          checkoutPayload = checkoutRes.payfastData;
        }
      } catch (e) {
        console.warn("[Payfast Redirection] Server checkout fallback:", e);
      }

      const isProduction = import.meta.env.VITE_PAYFAST_ENV === 'production';
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = isProduction 
        ? 'https://www.payfast.co.za/eng/process' 
        : 'https://sandbox.payfast.co.za/eng/process';
      form.target = '_blank';

      const addInput = (name: string, value: string) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.appendChild(input);
      };

      if (checkoutPayload) {
        Object.keys(checkoutPayload).forEach(k => {
          addInput(k, String(checkoutPayload[k]));
        });
        addInput('return_url', window.location.href);
        addInput('cancel_url', window.location.href);
        const origin = window.location.origin;
        addInput('notify_url', `${origin}/api/payfast-itn`);
      } else {
        const masterMID = import.meta.env.VITE_PAYFAST_MERCHANT_ID || '10000100';
        const masterMKey = import.meta.env.VITE_PAYFAST_MERCHANT_KEY || '46f09dbf5c057';
        
        addInput('merchant_id', masterMID);
        addInput('merchant_key', masterMKey);

        const clubMerchantId = clubInfo?.payfast_merchant_id || '';
        if (clubMerchantId) {
          addInput('setup', JSON.stringify({
            split_payment: { merchant_id: clubMerchantId, percentage: 95 }
          }));
        }
        
        const promoSuffix = appliedPromo ? ` [Promo: ${appliedPromo.code}]` : '';
        addInput('amount', totalAmount.toFixed(2));
        addInput('item_name', `${quantity}x ${item.title || item.name}${promoSuffix} [Proof Club]`);
        addInput('item_description', `${item.description || 'Exclusive allocation from Proof Control Center'}${appliedPromo ? ` (Promo ${appliedPromo.code} Applied)` : ''}`);
        
        addInput('return_url', window.location.href);
        addInput('cancel_url', window.location.href);
        const origin = window.location.origin;
        addInput('notify_url', `${origin}/api/payfast-itn`);
        
        addInput('email_address', userEmail);
        addInput('m_payment_id', `TX-${itemType.toUpperCase().slice(0,3)}-${item.id.slice(0, 8)}-${Date.now()}`);

        addInput('custom_str1', dbUser?.id || 'demo-user-id');
        addInput('custom_str2', item.club_id || '');
        addInput('custom_str3', item.id);
        addInput('custom_str4', itemType);
        addInput('custom_str5', String(quantity));
        if (appliedPromo) {
          addInput('custom_int1', String(appliedPromo.id));
        }
      }

      document.body.appendChild(form);
      form.submit();
      document.body.removeChild(form);
      
      handleVirtualSuccess();
    } catch (e: any) {
      setErrorMessage(e.message || 'Payment redirection failed');
      setStep('error');
    }
  };

  const handleVirtualSuccess = async () => {
    setStep('processing');
    try {
      let dbUpdatedData = null;
      if (itemType !== 'subscription' && itemType !== 'club_membership') {
        console.log(`[Virtual Success API] Deducting ${quantity} from ${itemType} inventory...`);
        const { data, error } = await buyPayfastItem(item.id, itemType, quantity);
        if (error) {
          throw error;
        }
        dbUpdatedData = data;
      }

      // Generate realistic recipe tokens
      const reference = `PF-RECB-${Math.floor(100000 + Math.random() * 900000)}`;
      const signature = Math.random().toString(36).substring(2, 10).toUpperCase();

      // Write real purchase records to Supabase tables (orders & child-tickets / product details)
      if (dbUser?.id || !supabase) {
        try {
          const userId = dbUser?.id || 'demo-user-id';
          if (itemType === 'subscription') {
            const planOption = item.id.includes('annual') ? 'annual' : 'monthly';
            const cost = totalAmount; // Reflect applied promo discount
            
            // Register active subscription in the database
            const { createOrUpdateSubscription } = await import('../services/supabase');
            await createOrUpdateSubscription(userId, planOption, cost, signature);

            const orderParams = {
              userId: userId,
              clubId: null,
              itemType: 'subscription' as const,
              itemId: item.id,
              itemName: `${planOption === 'annual' ? 'Annual' : 'Monthly'} Membership Subscription${appliedPromo ? ` (${appliedPromo.code})` : ''}`,
              quantity: 1,
              unitPrice: cost,
              payfastPaymentId: reference,
              payfastPfPaymentId: signature,
              notes: `Subscribed and joined ${planOption === 'annual' ? 'Annual' : 'Monthly'} premium membership.${appliedPromo ? ` Promo: ${appliedPromo.code}` : ''}`
            };
            console.log("[Virtual Success API] Registering premium subscription order in database:", orderParams);
            await createPayfastOrder(orderParams);
          } else if (itemType === 'club_membership') {
            const planOption = item.id.includes('annual') ? 'annual' : 'monthly';
            const cost = totalAmount; // Reflect applied promo discount
            const clubId = item.club_id;

            // Register paid club membership in the database (via processPayfastITN)
            const { processPayfastITN } = await import('../services/supabase');
            await processPayfastITN(userId, clubId, 'club_membership');

            const orderParams = {
              userId: userId,
              clubId: clubId,
              itemType: 'club_membership' as const,
              itemId: item.id,
              itemName: `${item.title || item.name}${appliedPromo ? ` (${appliedPromo.code})` : ''}`,
              quantity: 1,
              unitPrice: cost,
              payfastPaymentId: reference,
              payfastPfPaymentId: signature,
              notes: `Subscribed and joined club ${item.club_name || 'Club'} via ${planOption === 'annual' ? 'Annual' : 'Monthly'} membership.${appliedPromo ? ` Promo: ${appliedPromo.code}` : ''}`
            };
            console.log("[Virtual Success API] Registering paid club membership order in database:", orderParams);
            await createPayfastOrder(orderParams);
          } else {
            const orderParams = {
              userId: userId,
              clubId: item.club_id || null,
              itemType: itemType === 'event' ? ('event_ticket' as const) : ('product' as const),
              itemId: item.id,
              itemName: `${item.title || item.name}${appliedPromo ? ` (${appliedPromo.code})` : ''}`,
              quantity: quantity,
              unitPrice: totalAmount / quantity,
              payfastPaymentId: reference,
              payfastPfPaymentId: signature,
              eventDate: itemType === 'event' ? item.date : undefined,
              notes: itemType === 'event' 
                ? `Booked event ticket in Payfast Secure Express Gate${appliedPromo ? `. Promo: ${appliedPromo.code}` : ''}` 
                : `Purchased boutique collection item in Payfast Secure Express Gate${appliedPromo ? `. Promo: ${appliedPromo.code}` : ''}`
            };
            console.log("[Virtual Success API] Persisting real transaction metadata into Supabase:", orderParams);
            await createPayfastOrder(orderParams);
          }

          if (appliedPromo) {
            try {
              const { recordPromoRedemption } = await import('../services/supabase');
              await recordPromoRedemption(appliedPromo.id, reference, userId);
            } catch (rErr) {
              console.warn("Failed to record promo redemption:", rErr);
            }
          }
        } catch (dbErr) {
          console.warn("[Virtual Success API] Database write failed for order logs (non-blocking for checkout flow):", dbErr);
        }
      } else {
        console.warn("[Virtual Success API] No database user identified, skipping backend transactional logging.");
      }
      
      setReceiptToken({
        reference,
        signature,
        amount: totalAmount,
        quantity,
        date: new Date().toLocaleString(),
        itemName: item.title || item.name,
        bankName: paymentMethod === 'eft' ? selectedBank : 'Secured Visa Card Checkout'
      });

      setStep('success');
      if (onSuccess) {
        onSuccess(dbUpdatedData || item);
      }
    } catch (err: any) {
      console.error("[Virtual Success API] Error saving payment state:", err);
      setErrorMessage(err.message || 'Payment transaction failed on supply audit.');
      setStep('error');
    }
  };

  const handleVirtualPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep('processing');
    setTimeout(() => {
      handleVirtualSuccess();
    }, 2800); // realistic payment terminal auth duration
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/90 backdrop-blur-xl"
        />

        {/* Modal content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 30 }}
          className="relative bg-surface-container rounded-3xl border border-white/10 w-full max-w-lg overflow-hidden flex flex-col shadow-2xl z-10"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/5 bg-black/20">
            <div className="flex items-center gap-2">
              <span className="text-xl font-serif text-white">Secure Express Gate</span>
              <span className="text-[9px] bg-[#d8c39b]/10 text-[#d8c39b] border border-[#d8c39b]/20 px-2 py-0.5 rounded font-mono font-bold tracking-wider">PAYFAST</span>
            </div>
            <button 
              onClick={onClose} 
              className="p-1.5 rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-6 flex-1 overflow-y-auto">
            {step === 'options' && (
              <div className="space-y-6">
                {/* Item Brief */}
                <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                  <div className="w-16 h-16 bg-black/40 rounded-xl overflow-hidden flex-shrink-0 border border-white/10">
                    <img 
                      src={item.image || (item.title?.toLowerCase().includes('annual') ? 'https://images.unsplash.com/photo-1599940824399-b87987ceb72a?auto=format&fit=crop&q=80&w=400' : 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&q=80&w=400')} 
                      alt={item.title || item.name} 
                      className="w-full h-full object-cover" 
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[9px] font-extrabold text-primary tracking-widest uppercase block mb-0.5">
                      {itemType === 'event' ? 'Club Ticket Booking' : itemType === 'subscription' ? 'Membership Subscription' : itemType === 'club_membership' ? 'Paid Club Membership' : 'Boutique Collection Item'}
                    </span>
                    <h4 className="text-white text-base font-serif truncate">{item.title || item.name}</h4>
                    <p className="text-secondary font-mono text-sm font-semibold mt-1">R {pfPriceZar.toFixed(2)}</p>
                  </div>
                </div>

                {/* Info about Stock */}
                {availableStock !== null && (
                  <div className="flex items-center justify-between px-2 text-xs">
                    <span className="text-white/40 uppercase tracking-wider text-[10px] font-bold">Supply Inventory</span>
                    {isSoldOut ? (
                      <span className="text-red-400 font-bold uppercase tracking-widest">● Sold Out / Exceeded</span>
                    ) : (
                      <span className="text-green-400 font-bold uppercase tracking-widest">● {availableStock} Allocation(s) Available</span>
                    )}
                  </div>
                )}

                {/* Quantity Control */}
                {!isSoldOut && (
                  <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-white/80 font-serif text-sm">Select Quantity</span>
                      <div className="flex items-center gap-4 bg-black/40 px-3 py-1.5 rounded-xl border border-white/10">
                        <button 
                          type="button"
                          className="text-white/60 hover:text-white font-mono font-bold text-lg px-2"
                          onClick={() => setQuantity(q => Math.max(1, q - 1))}
                        >
                          -
                        </button>
                        <span className="text-white font-mono font-bold text-sm min-w-[20px] text-center">{quantity}</span>
                        <button 
                          type="button"
                          className="text-white/60 hover:text-white font-mono font-bold text-lg px-2"
                          onClick={() => setQuantity(q => availableStock !== null ? Math.min(availableStock, q + 1) : q + 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Promo Code Input */}
                    <div className="pt-3 pb-1 border-t border-white/5 space-y-2">
                      {appliedPromo ? (
                        <div className="flex items-center justify-between bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2">
                          <div className="flex items-center gap-2">
                            <Tag size={14} className="text-green-400" />
                            <span className="text-xs text-green-400 font-mono font-bold uppercase">{appliedPromo.code}</span>
                          </div>
                          <button onClick={handleRemovePromo} className="text-white/40 hover:text-white transition-colors">
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center gap-2">
                            <input 
                              type="text"
                              value={promoCodeInput}
                              onChange={e => setPromoCodeInput(e.target.value)}
                              placeholder="Have a promo code?"
                              className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 outline-none focus:border-primary text-xs font-mono uppercase text-white"
                            />
                            <button 
                              onClick={handleApplyPromo}
                              disabled={validatingPromo || !promoCodeInput.trim()}
                              className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors disabled:opacity-50 flex items-center gap-1"
                            >
                              {validatingPromo ? <Loader2 size={12} className="animate-spin" /> : 'Apply'}
                            </button>
                          </div>
                          {promoError && (
                            <p className="text-red-400 text-[10px] mt-1 pl-1 font-medium">{promoError}</p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between items-center pt-3 border-t border-white/5">
                      <span className="text-white/40 text-xs uppercase tracking-wider">Subtotal Due</span>
                      <div className="text-right">
                        {appliedPromo && (
                          <span className="text-white/40 font-mono text-[10px] line-through block">R {subtotalAmount.toFixed(2)}</span>
                        )}
                        <span className="text-white font-mono font-bold text-lg">R {totalAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {isSoldOut ? (
                  <div className="p-4 bg-red-950/20 border border-red-500/20 rounded-2xl text-center space-y-2">
                    <AlertTriangle className="text-red-400 mx-auto" size={24} />
                    <p className="text-sm text-red-300 font-medium">Allocation Exhausted</p>
                    <p className="text-xs text-red-200/50">This event or boutique release is complete. Please contact the Club Master Admin for waiting list placements.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Option 1: Gateway Redirect */}
                    <button
                      onClick={handlePayfastRedirect}
                      className="w-full h-16 bg-primary text-black rounded-full font-bold flex items-center justify-center gap-3 active:scale-[0.98] transition-all shadow-lg hover:brightness-105"
                    >
                      <Lock size={18} />
                      PAY VIA PAYFAST
                    </button>

                    {/* Option 2: Simulated In-App Secured Payment Gate */}
                    <button
                      onClick={() => setStep('card')}
                      className="w-full h-16 bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 hover:text-white rounded-full font-bold flex items-center justify-center gap-3 transition-colors text-xs uppercase tracking-widest"
                    >
                      <ShieldCheck size={16} />
                      Vault Checkout
                    </button>
                    <p className="text-[10px] text-white/30 text-center leading-normal">
                      Security monitored by Payfast South Africa. Standard transactions are encrypted in transit. Payments will process securely in a new tab.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Simulated Card Payment Screen */}
            {step === 'card' && (
              <form onSubmit={handleVirtualPaymentSubmit} className="space-y-5">
                <div className="flex items-center gap-2 mb-2 p-1 bg-white/5 rounded-xl border border-white/5">
                  <button 
                    type="button"
                    onClick={() => { setPaymentMethod('card'); }}
                    className={`flex-1 h-11 rounded-lg text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 ${paymentMethod === 'card' ? 'bg-primary text-black' : 'text-white/40'}`}
                  >
                    <CreditCard size={14} /> Credit Card
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setPaymentMethod('eft'); }}
                    className={`flex-1 h-11 rounded-lg text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 ${paymentMethod === 'eft' ? 'bg-primary text-black' : 'text-white/40'}`}
                  >
                    <Landmark size={14} /> Instant EFT
                  </button>
                </div>

                {paymentMethod === 'card' ? (
                  <div className="space-y-4">
                    {/* Visual Card Mock */}
                    <div className="h-[150px] rounded-2xl bg-gradient-to-br from-neutral-800 to-neutral-950 p-6 border border-white/10 flex flex-col justify-between relative overflow-hidden shadow-inner">
                      <div className="absolute right-6 top-6 text-white/10 font-serif font-extrabold italic text-4xl select-none">VISA</div>
                      <div className="flex justify-between items-start">
                        <div className="w-10 h-7 bg-amber-500/20 border border-amber-500/50 rounded" />
                        <span className="text-[9px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded font-mono font-bold uppercase">PROOF SECURE</span>
                      </div>
                      <div>
                        <p className="text-white font-mono text-sm tracking-widest mb-1">
                          {cardNumber || '•••• •••• •••• ••••'}
                        </p>
                        <div className="flex justify-between items-end text-[9px] font-mono text-white/40">
                          <div>
                            <span className="block uppercase leading-none mb-0.5">Cardholder</span>
                            <span className="text-[11px] text-white tracking-widest uppercase">{cardName || 'YOUR FULL NAME'}</span>
                          </div>
                          <div>
                            <span className="block uppercase leading-none mb-0.5">Expires</span>
                            <span className="text-white tracking-widest">{cardExpiry || 'MM/YY'}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-1 block">Cardholder Name</label>
                        <input 
                          required
                          value={cardName}
                          onChange={e => setCardName(e.target.value)}
                          placeholder="e.g. S. Rademeyer"
                          className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 outline-none text-sm text-white focus:border-primary"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-1 block">Card Number</label>
                        <input 
                          required
                          maxLength={19}
                          value={cardNumber}
                          onChange={e => {
                            // simple space mapping
                            const cleanStr = e.target.value.replace(/\s?/g, '');
                            const matched = cleanStr.match(/.{1,4}/g);
                            setCardNumber(matched ? matched.join(' ') : cleanStr);
                          }}
                          placeholder="4000 1234 5678 9010"
                          className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 outline-none text-sm text-white font-mono focus:border-primary"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-1 block">Expiration Date</label>
                          <input 
                            required
                            maxLength={5}
                            value={cardExpiry}
                            onChange={e => {
                              const v = e.target.value;
                              if (v.length === 2 && cardExpiry.length === 1) {
                                setCardExpiry(v + '/');
                              } else {
                                setCardExpiry(v);
                              }
                            }}
                            placeholder="MM/YY"
                            className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 outline-none text-sm text-white font-mono text-center focus:border-primary"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-1 block">Security CVV</label>
                          <input 
                            required
                            maxLength={3}
                            value={cardCvv}
                            onChange={e => setCardCvv(e.target.value)}
                            placeholder="123"
                            className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 outline-none text-sm text-white font-mono text-center focus:border-primary"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-1 block">Select Banking Institution</label>
                      <select 
                        required
                        value={selectedBank}
                        onChange={e => setSelectedBank(e.target.value)}
                        className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 outline-none text-sm text-white focus:border-primary"
                      >
                        <option value="" className="bg-black text-white/30" disabled>Select Bank...</option>
                        <option value="Capitec Bank" className="bg-black">Capitec Bank</option>
                        <option value="First National Bank (FNB)" className="bg-black">First National Bank (FNB)</option>
                        <option value="Standard Bank" className="bg-black">Standard Bank</option>
                        <option value="ABSA" className="bg-black">ABSA</option>
                        <option value="Nedbank" className="bg-black">Nedbank</option>
                        <option value="TymeBank" className="bg-black">TymeBank</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-1 block">Account Number / Username</label>
                      <input 
                        required
                        value={accountNumber}
                        onChange={e => setAccountNumber(e.target.value)}
                        placeholder="e.g. 10082914022"
                        className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 outline-none text-sm text-white font-mono focus:border-primary"
                      />
                    </div>
                    <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-start gap-3">
                      <Lock className="text-primary mt-0.5 flex-shrink-0" size={16} />
                      <p className="text-[10px] text-white/60 leading-normal">
                        <strong>Instant EFT Guarantee:</strong> Secured by Payfast. Once you proceed, a simulated one-time authentication PIN will be triggered to finalize ZAR funds transfer immediately.
                      </p>
                    </div>
                  </div>
                )}

                {/* Submit Action */}
                <div className="flex gap-4 pt-4 border-t border-white/5">
                  <button 
                    type="button" 
                    onClick={() => setStep('options')}
                    className="flex-1 h-14 bg-white/5 border border-white/10 rounded-2xl font-bold font-mono text-xs uppercase text-white/60 hover:text-white"
                  >
                    Go Back
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] h-14 bg-primary text-black rounded-2xl font-bold flex items-center justify-center gap-2 text-sm"
                  >
                    AUTHORISE R {totalAmount.toFixed(2)}
                    <ArrowRight size={16} />
                  </button>
                </div>
              </form>
            )}

            {/* Simulated terminal processing overlay */}
            {step === 'processing' && (
              <div className="py-16 text-center space-y-6 flex flex-col items-center">
                <Loader2 className="animate-spin text-primary" size={48} />
                <div className="space-y-2 max-w-xs">
                  <h4 className="text-white text-base font-serif">Awaiting Bank Authorization</h4>
                  <p className="text-white/40 text-xs leading-normal">
                    Establishing handshakes with payfast merchant terminal and ZAR clearing databases. Generating 3D-Secure tokens. Do not refresh...
                  </p>
                </div>
              </div>
            )}

            {/* Successful Checkout Screen */}
            {step === 'success' && receiptToken && (
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <CheckCircle2 className="text-green-400 mx-auto" size={54} />
                  <h4 className="text-white text-2xl font-serif">Security Approved</h4>
                  <p className="text-green-300/80 text-xs font-medium uppercase tracking-wider">Payment Transaction Cleared Successful</p>
                </div>

                {/* Printable receipt ticket mock */}
                <div className="bg-black/40 border border-white/10 rounded-2xl p-6 font-mono text-xs text-white/70 space-y-4 shadow-inner relative">
                  <div className="absolute right-6 top-6 opacity-5 border border-white tracking-widest font-extrabold rotate-[15deg]">PAID</div>
                  <div className="text-center border-b border-white/10 pb-3">
                    <h5 className="text-white font-serif font-bold tracking-wider text-sm">PROOF CONTROL CENTER RECEIPT</h5>
                    <p className="text-[9px] uppercase tracking-wider text-white/30 block mt-1">Cape Town, South Africa</p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Item Ident:</span>
                      <span className="text-white font-serif truncate max-w-[180px]">{receiptToken.itemName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Transaction ID:</span>
                      <span className="text-white">{receiptToken.reference}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Gateway Sig:</span>
                      <span className="text-white select-all">{receiptToken.signature}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Order Quantity:</span>
                      <span className="text-white">{receiptToken.quantity} units</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Settled Bank:</span>
                      <span className="text-white">{receiptToken.bankName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cleared Time:</span>
                      <span className="text-white text-[10px]">{receiptToken.date}</span>
                    </div>
                  </div>

                  <div className="border-t border-dashed border-white/20 pt-3 flex justify-between items-center text-sm font-bold">
                    <span className="uppercase text-white/40">ZAR Cleared Total:</span>
                    <span className="text-primary text-base font-mono">R {receiptToken.amount.toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => window.print()}
                    className="flex-1 h-14 bg-white/5 border border-white/10 rounded-2xl text-white/40 hover:text-white flex items-center justify-center gap-2 font-bold font-mono text-xs uppercase"
                  >
                    <Printer size={16} /> Print Receipt
                  </button>
                  <button 
                    onClick={onClose}
                    className="flex-[2] h-14 bg-primary text-black rounded-2xl font-bold flex items-center justify-center text-sm uppercase tracking-wider"
                  >
                    Verify & Close
                  </button>
                </div>
              </div>
            )}

            {/* Error screen */}
            {step === 'error' && (
              <div className="py-12 text-center space-y-6 flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 text-red-400">
                  <AlertTriangle size={32} />
                </div>
                <div className="space-y-2 max-w-xs">
                  <h4 className="text-white text-lg font-serif">Authorization Declined</h4>
                  <p className="text-red-300 font-mono text-xs bg-red-950/20 px-3 py-1.5 rounded-lg border border-red-500/10 leading-relaxed">
                    {errorMessage}
                  </p>
                  <p className="text-white/40 text-[11px] leading-normal pt-2">
                    Please ensure ZAR balances are sufficient and cards/EFT authorization is supported for internet payments, then retry.
                  </p>
                </div>
                <button 
                  onClick={() => setStep('options')}
                  className="w-full max-w-xs h-14 bg-white/5 border border-white/10 rounded-2xl font-bold font-mono text-xs uppercase text-white hover:bg-white/10"
                >
                  Retry Transaction Gate
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
