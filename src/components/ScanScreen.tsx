import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Zap, Image as ImageIcon, CheckCircle2, Loader2, X, AlertCircle } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { identifyWhisky } from '../services/geminiService';

export default function ScanScreen({ onComplete }: { onComplete: (whisky: any) => void }) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let activeStream: MediaStream | null = null;

    // Attempt to start camera stream on mount
    async function startCamera() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' },
          audio: false 
        });
        activeStream = mediaStream;
        setStream(mediaStream);
      } catch (err) {
        console.warn("Camera access denied or not available:", err);
      }
    }
    startCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Update video element srcObject once stream is loaded and element is mounted
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const handleIdentify = async (imageData: string, mimeType: string) => {
    setScanning(true);
    setError(null);
    try {
      const result = await identifyWhisky(imageData, mimeType);
      onComplete({
        ...result,
        id: Math.random().toString(36).substr(2, 9),
        image: imageData // Keep the original image for the journal
      });
    } catch (err) {
      console.error("Scanning error:", err);
      setError("AI was unable to read this label. Please try common vault items or ensure label is clear.");
      setScanning(false);
    }
  };

  const handleScan = () => {
    if (!videoRef.current) {
      // Fallback if camera not active
      handleIdentify("https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b", "image/jpeg");
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg');
      handleIdentify(dataUrl, 'image/jpeg');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (re) => {
        if (re.target?.result) {
          handleIdentify(re.target.result as string, file.type);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex-1 relative overflow-hidden flex flex-col pt-10">
      {/* Viewfinder Mock / Real Video */}
      <div className="absolute inset-0 z-0 bg-black">
        {stream ? (
          <video 
            ref={videoRef}
            autoPlay 
            playsInline 
            className="w-full h-full object-cover opacity-80"
          />
        ) : (
          <img 
            src="https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&q=80&w=1200" 
            className="w-full h-full object-cover opacity-60"
            alt="Camera placeholder"
          />
        )}
        <div className="absolute inset-0 bg-black/20" />
      </div>

      <div className="relative z-10 px-8 flex-1 flex flex-col items-center justify-between pt-12 pb-24">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass p-6 rounded-3xl text-center max-w-xs"
        >
          <p className="text-label-md text-primary mb-2 uppercase tracking-widest font-bold">
            {scanning ? 'Analyzing Vintage' : 'Label Recognition Active'}
          </p>
          <p className="text-sm text-balance leading-relaxed text-on-surface-variant">
            {scanning 
              ? 'Our neural network is identifying the distillery, age, and character...'
              : error 
                ? <span className="text-error flex items-center gap-2 justify-center"><AlertCircle size={14} /> {error}</span>
                : 'Align the bottle or label within the frame for instant vintage analysis.'}
          </p>
        </motion.div>

        {/* Viewfinder Frame */}
        <div className="relative w-64 h-80">
          <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-primary" />
          <div className="absolute top-0 right-0 w-12 h-12 border-t-2 border-r-2 border-primary" />
          <div className="absolute bottom-0 left-0 w-12 h-12 border-b-2 border-l-2 border-primary" />
          <div className="absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 border-primary" />
          
          <AnimatePresence>
            {scanning ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm rounded-lg"
              >
                <div className="relative">
                  <Loader2 className="w-16 h-16 text-primary animate-spin" />
                  <motion.div 
                    initial={{ y: 0 }}
                    animate={{ y: [0, 80, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-x-0 h-0.5 bg-primary/40 shadow-[0_0_15px_rgba(var(--primary),0.5)] z-20"
                    style={{ top: '20%' }}
                  />
                </div>
                <p className="mt-4 text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">Processing</p>
              </motion.div>
            ) : (
              <motion.div 
                animate={{ 
                  scale: [1, 1.1, 1],
                  opacity: [0.5, 0.8, 0.5]
                }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <div className="w-12 h-12 border-2 border-white/20 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-8">
          <button 
            disabled={scanning}
            className="w-14 h-14 rounded-full glass flex items-center justify-center text-white/60 hover:text-white transition-colors disabled:opacity-50"
          >
            <Zap size={24} />
          </button>
          
          <motion.button 
            whileTap={{ scale: 0.9 }}
            disabled={scanning}
            onClick={handleScan}
            className="w-20 h-20 rounded-full border-[6px] border-white/20 p-2 group relative disabled:opacity-50"
          >
            <div className="w-full h-full bg-primary rounded-full flex items-center justify-center text-on-primary transition-transform group-active:scale-95">
              <Camera size={32} />
            </div>
          </motion.button>

          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*" 
            onChange={handleFileChange}
          />
          <button 
            disabled={scanning}
            onClick={() => fileInputRef.current?.click()}
            className="w-14 h-14 rounded-full glass flex items-center justify-center text-white/60 hover:text-white transition-colors disabled:opacity-50"
          >
            <ImageIcon size={24} />
          </button>
        </div>
      </div>
    </div>
  );
}
