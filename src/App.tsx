import React, { useState, useRef, useEffect } from "react";
import { 
  Search, 
  Smartphone, 
  Home, 
  PawPrint, 
  Zap, 
  Loader2,
  ChevronRight,
  Package,
  ExternalLink,
  DollarSign,
  Settings as SettingsIcon,
  X,
  Save,
  LogIn,
  LogOut,
  User as UserIcon,
  BarChart as LucideBarChart,
  TrendingUp,
  MousePointer2,
  Calendar,
  Star,
  ShoppingBag,
  Plus,
  RefreshCw,
  Trash2,
  Eye,
  CheckCircle2,
  ChevronDown,
  ArrowUpRight,
  Heart,
  Share2,
  ShieldCheck,
  Truck,
  RotateCcw,
  MapPin,
  PlayCircle,
  Play,
  ImagePlus,
  ThumbsUp,
  Info
} from "lucide-react";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  BarChart as RechartsBarChart, 
  Bar, 
  Cell 
} from "recharts";

const TRAFFIC_DATA = [
  { name: 'Nov 17', clicks: 400, sessions: 240 },
  { name: 'Jul 23', clicks: 800, sessions: 400 },
  { name: 'Oct 21', clicks: 1200, sessions: 600 },
  { name: 'Mar 18', clicks: 900, sessions: 500 },
  { name: 'Apr 25', clicks: 1000, sessions: 450 },
  { name: 'May 23', clicks: 1500, sessions: 800 },
];

const REVENUE_DATA = [
  { name: 'Nov 13', value: 30000 },
  { name: 'Jan 7', value: 45000 },
  { name: 'Mar 17', value: 35000 },
  { name: 'May 20', value: 70000 },
  { name: 'Jul 15', value: 55000 },
  { name: 'Sep 10', value: 85000 },
];
import { motion, AnimatePresence } from "motion/react";
import { getGeminiResponse, getMarketingStrategy } from "./services/gemini";
import { Product, Settings } from "./types";
import { db, auth } from "./lib/firebase";
import { doc, getDoc, setDoc, updateDoc, collection, addDoc, getDocs, query, orderBy, limit, deleteDoc } from "firebase/firestore";
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const CATEGORIES = [
  { id: "lighting", name: "Smart Lighting", icon: Zap, color: "text-yellow-400", prompt: "Recommend 12 top-rated smart LED floor and table lamps for 2024." },
  { id: "vacuums", name: "Robot Vacuums", icon: Package, color: "text-blue-400", prompt: "Find 15 of the best mapping robot vacuum cleaners available on Amazon US." },
  { id: "kitchen", name: "Smart Kitchen", icon: Home, color: "text-emerald-400", prompt: "List 12 trending innovative smart kitchen appliances for 2024." },
  { id: "audio", name: "Portable Audio", icon: Smartphone, color: "text-purple-400", prompt: "Top 12 must-have portable bluetooth speakers for 2024." },
  { id: "mobile", name: "Mobile Accessories", icon: Smartphone, color: "text-indigo-400", prompt: "Best-selling innovative mobile chargers and accessories for 2024." },
  { id: "pets", name: "Smart Pet Tech", icon: PawPrint, color: "text-rose-400", prompt: "Innovative smart pet feeders and pet tech gadgets for 2024." },
];

const DEFAULT_SETTINGS: Settings = {
  affiliateTag: "smartgadget-20"
};

const parsePrice = (priceStr: string | undefined) => {
  if (!priceStr) return { whole: "0", fraction: "00", full: "$0.00" };
  const clean = priceStr.replace("$", "").trim();
  const parts = clean.split(".");
  const whole = parts[0] || "0";
  let fraction = parts[1] || "00";
  if (fraction.length === 0) fraction = "00";
  if (fraction.length === 1) fraction += "0";
  return {
    whole,
    fraction: fraction.substring(0, 2),
    full: `$${whole}.${fraction.substring(0, 2)}`
  };
};

export default function App() {
  const [queryInput, setQueryInput] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [user, setUser] = useState<User | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [stats, setStats] = useState({ totalClicks: 0, recentClicks: [] as any[] });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [view, setView] = useState<'home' | 'product' | 'admin'>('home');
  const [marketingStrategy, setMarketingStrategy] = useState<string | null>(null);
  const [isGeneratingStrategy, setIsGeneratingStrategy] = useState(false);
  const [mainImage, setMainImage] = useState<string | null>(null);

  const isAdmin = (user: User | null) => 
    user?.email === 'chinaonlinebdpurchase2@gmail.com' || 
    user?.uid === 'Sl4zsHpVgqVOEVpWYx3Cl4DvydE2';

  useEffect(() => {
    if (selectedProduct) {
      setMainImage(selectedProduct.image_url);
    }
  }, [selectedProduct]);
  const [isManualAdding, setIsManualAdding] = useState(false);
  const [manualProduct, setManualProduct] = useState<Partial<Product>>({
    name: "",
    brand: "",
    price: "",
    asin: "",
    category: "Smart Home",
    image_url: "",
    affiliate_link: "",
    description: "",
    highlights: [],
    description_bullets: [],
    video_url: "",
    images: []
  });
  const productsSectionRef = useRef<HTMLDivElement>(null);
  const categoriesSectionRef = useRef<HTMLDivElement>(null);
  const dealsSectionRef = useRef<HTMLDivElement>(null);
  const newTechSectionRef = useRef<HTMLDivElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file: File) => {
      if ((manualProduct.images?.length || 0) >= 10) return;
      const reader = new FileReader();
      reader.onloadend = () => {
        setManualProduct(prev => ({
          ...prev,
          images: [...(prev.images || []), reader.result as string]
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const handleEditProduct = (product: Product) => {
    setManualProduct({ ...product });
    setIsManualAdding(true);
  };

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const totalPages = products ? Math.ceil(products.length / itemsPerPage) : 0;
  const currentItems = products ? products.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage) : [];

  const handleManualAdd = async () => {
    if (!manualProduct.name || !manualProduct.price) {
      alert("Please fill in at least the product name and price.");
      return;
    }

    const fullProduct: Product = {
      id: manualProduct.id || manualProduct.asin || `man-${Date.now()}`,
      name: manualProduct.name!,
      brand: manualProduct.brand || "",
      price: manualProduct.price!,
      asin: manualProduct.asin || "",
      category: manualProduct.category || "Smart Home",
      image_url: manualProduct.image_url || "https://placehold.co/600x400/0a1120/white?text=No+Image",
      affiliate_link: manualProduct.affiliate_link || `https://www.amazon.com/dp/${manualProduct.asin}?tag=${settings.affiliateTag}`,
      description: manualProduct.description || "",
      highlights: manualProduct.highlights || [],
      description_bullets: manualProduct.description_bullets || [],
      video_url: manualProduct.video_url || "",
      images: manualProduct.images || [],
      rating: manualProduct.rating || "5.0",
      review_count: manualProduct.review_count || "1",
      trust_badge: manualProduct.trust_badge || "Curated"
    };

    if (user) {
      await persistProducts([fullProduct]);
      setProducts(prev => {
        if (!prev) return [fullProduct];
        const exists = prev.findIndex(p => p.id === fullProduct.id);
        if (exists !== -1) {
          const updated = [...prev];
          updated[exists] = fullProduct;
          return updated;
        }
        return [fullProduct, ...prev];
      });
      setIsManualAdding(false);
      // Reset form
      setManualProduct({
        name: "",
        brand: "",
        price: "",
        asin: "",
        category: "Smart Home",
        image_url: "",
        affiliate_link: "",
        description: "",
        highlights: [],
        description_bullets: [],
        video_url: "",
        images: [],
        id: undefined
      });
    }
  };
  const handleGenerateStrategy = async () => {
    if (!selectedProduct) return;
    setIsGeneratingStrategy(true);
    try {
      const strategy = await getMarketingStrategy(selectedProduct.name, selectedProduct.affiliate_link);
      setMarketingStrategy(strategy);
    } catch (error) {
      console.error(error);
    } finally {
      setIsGeneratingStrategy(false);
    }
  };

  useEffect(() => {
    if (view === 'product') {
       setMarketingStrategy(null);
    }
  }, [view]);

  // Fetch Stats when Admin opens
  useEffect(() => {
    if (view === 'admin' && isAdmin(user)) {
      const fetchStats = async () => {
        try {
          const clicksSnap = await getDocs(query(collection(db, "clicks"), orderBy("timestamp", "desc"), limit(5)));
          const allClicksSnap = await getDocs(collection(db, "clicks"));
          setStats({
            totalClicks: allClicksSnap.size,
            recentClicks: clicksSnap.docs.map(doc => doc.data())
          });
        } catch (error) {
          console.error("Error fetching stats:", error);
        }
      };
      fetchStats();
    }
  }, [view, user]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login Error:", error);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setView('home');
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  useEffect(() => {
    const fetchSettings = async () => {
      const path = "settings/global";
      try {
        const settingsDoc = await getDoc(doc(db, "settings", "global"));
        if (settingsDoc.exists()) {
          setSettings(settingsDoc.data() as Settings);
        } else if (isAdmin(user)) {
          await setDoc(doc(db, "settings", "global"), DEFAULT_SETTINGS);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, path);
      }
    };
    fetchSettings();
  }, [user]);

  const saveSettings = async (newSettings: Settings) => {
    const path = "settings/global";
    try {
      if (!isAdmin(user)) return;
      await updateDoc(doc(db, "settings", "global"), { ...newSettings });
      setSettings(newSettings);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const logClick = async (id: string) => {
    const path = "clicks";
    try {
      await addDoc(collection(db, "clicks"), {
        id,
        timestamp: new Date().toISOString(),
        userId: user?.uid || "anonymous"
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const persistProducts = async (newProducts: Product[]) => {
    if (!isAdmin(user)) return; 
    
    for (const product of newProducts) {
      if (!product.id) continue;
      const path = `products/${product.id}`;
      try {
        await setDoc(doc(db, "products", product.id), {
          ...product,
          createdAt: new Date().toISOString(),
          hidden: false
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    }
  };

  const deleteProduct = async (id: string) => {
    if (!id || !isAdmin(user)) return;
    if (!confirm("Are you sure you want to remove this product?")) return;
    
    try {
      // Optimistically update UI
      setProducts(prev => prev ? prev.filter(p => p.id !== id && p.asin !== id) : null);
      
      await deleteDoc(doc(db, "products", id));
      console.log("Product deleted from Firestore:", id);
    } catch (error) {
      console.error("Delete Error:", error);
      // Even if firestore fails, we want the UI to reflect the user's intent 
      // but maybe they need to know if it wasn't persistent
      alert("Note: Could not delete from database, but removed from current view. " + (error instanceof Error ? error.message : ""));
    }
  };

  const handleSyncAmazon = async () => {
    await handleSearch("Latest trending smart gadgets on Amazon US", false);
  };

  const handleSearch = async (inputQuery: string, quiet = false) => {
    if (!inputQuery.trim()) return;
    
    if (!quiet) setIsSearching(true);
    if (!quiet) setProducts(null);
    
    try {
      const data = await getGeminiResponse(inputQuery);
      
      const processedProducts = data.map((p: any) => {
        const id = p.id || p.asin || `gen-${Math.random().toString(36).substring(2, 11)}`;
        return {
          ...p,
          id,
          asin: p.asin || id,
          affiliate_link: (p.affiliate_link || "").replace("YOUR_TAG_HERE", settings.affiliateTag)
        };
      });

      setProducts(processedProducts);
      if (isAdmin(user)) {
        persistProducts(processedProducts);
      }

      if (!quiet && productsSectionRef.current) {
        window.scrollTo({
          top: productsSectionRef.current.offsetTop - 100,
          behavior: "smooth"
        });
      }
    } catch (error) {
      console.error(error);
      if (!quiet) alert("Error fetching products. Please try again.");
    } finally {
      if (!quiet) setIsSearching(false);
      setIsInitialLoading(false);
    }
  };

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "products"));
        if (!querySnapshot.empty) {
          const loadedProducts = querySnapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
          })) as Product[];
          setProducts(loadedProducts);
          setIsInitialLoading(false);
          console.log("Products loaded from Firestore:", loadedProducts.length);
        } else {
          // If empty, seed from AI search
          handleSearch("List 15 trending high-converting smart gadgets and home essentials for 2024 on Amazon US.", true);
        }
      } catch (error) {
        console.error("Error loading products:", error);
        handleSearch("List 15 trending high-converting smart gadgets and home essentials for 2024 on Amazon US.", true);
      }
    };
    loadProducts();
  }, [settings.affiliateTag]);

  return (
    <div className="min-h-screen bg-[#050b18] font-sans selection:bg-blue-500/30">
      {/* Background decorations */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-600/5 rounded-full blur-[180px]" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[50%] h-[70%] bg-blue-600/10 rounded-full blur-[150px]" />
      </div>

      {/* Navbar */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${(scrolled || view === 'product') ? "py-3 bg-[#050b18]/95 backdrop-blur-xl border-b border-white/5 shadow-2xl" : "py-6 bg-transparent"}`}>
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          <div className="flex items-center gap-2 group cursor-pointer" onClick={() => { setView('home'); setSelectedProduct(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
            <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-600 rounded-lg flex items-center justify-center transform group-hover:rotate-12 transition-transform duration-300">
              <ShoppingBag size={18} className="text-white md:hidden" />
              <ShoppingBag size={22} className="text-white hidden md:block" />
            </div>
            <span className="text-base md:text-xl font-display font-black text-white tracking-tight uppercase">Smart<span className="text-blue-500">Store</span></span>
          </div>

          <div className="hidden lg:flex items-center gap-8">
            <button 
              onClick={() => { setView('home'); setSelectedProduct(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              className="text-xs font-bold text-blue-400 border-b-2 border-blue-400 pb-0.5 tracking-widest uppercase"
            >
              Home
            </button>
            <div className="group relative">
              <button 
                onClick={() => categoriesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="text-xs font-bold text-slate-400 hover:text-white transition-colors tracking-widest uppercase flex items-center gap-1"
              >
                Shop by Category <ChevronRight size={14} className="rotate-90" />
              </button>
            </div>
            <button 
              onClick={() => dealsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="text-xs font-bold text-slate-400 hover:text-white transition-colors tracking-widest uppercase"
            >
              Deals
            </button>
            <button 
              onClick={() => newTechSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="text-xs font-bold text-slate-400 hover:text-white transition-colors tracking-widest uppercase"
            >
              New Arrivals
            </button>
            <button className="text-xs font-bold text-slate-400 hover:text-white transition-colors tracking-widest uppercase">About</button>
          </div>

          <div className="flex items-center gap-4">
            {isAdmin(user) && (
              <button onClick={() => setView('admin')} className={`p-2 transition-all rounded-full ${view === 'admin' ? "bg-blue-600/20 text-blue-400" : "text-slate-400 hover:bg-white/5"}`}>
                <SettingsIcon size={20} />
              </button>
            )}
            {!user && (
              <button onClick={login} className="text-[10px] font-black uppercase text-slate-500 hover:text-white transition-colors">Admin</button>
            )}
            {user && !isAdmin(user) && (
              <button onClick={logout} className="text-[10px] font-black uppercase text-slate-500 hover:text-white transition-colors">Logout</button>
            )}

            {/* Mobile Menu Toggle */}
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-white"
            >
              {mobileMenuOpen ? <X size={24} /> : <LucideBarChart size={24} className="rotate-90" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="lg:hidden bg-[#0a1120] border-b border-white/5 overflow-hidden"
            >
              <div className="flex flex-col p-6 gap-4">
                {[
                  { label: "Home", action: () => { setView('home'); window.scrollTo({ top: 0, behavior: "smooth" }); } },
                  { label: "Category", action: () => categoriesSectionRef.current?.scrollIntoView({ behavior: "smooth" }) },
                  { label: "Deals", action: () => dealsSectionRef.current?.scrollIntoView({ behavior: "smooth" }) },
                  { label: "New Tech", action: () => newTechSectionRef.current?.scrollIntoView({ behavior: "smooth" }) },
                ].map((item) => (
                  <button 
                    key={item.label}
                    onClick={() => { item.action(); setMobileMenuOpen(false); }}
                    className="text-left text-sm font-bold text-slate-400 uppercase tracking-widest py-2"
                  >
                    {item.label}
                  </button>
                ))}
                {isAdmin(user) && (
                   <button 
                     onClick={() => { setView('admin'); setMobileMenuOpen(false); }}
                     className="text-left text-sm font-bold text-blue-400 uppercase tracking-widest py-2 flex items-center gap-2"
                   >
                     <SettingsIcon size={16} /> Control Center
                   </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>


      {/* Main Content Area */}
      {view === 'home' ? (
        <main className="relative z-10 pt-40 px-6 pb-24 max-w-7xl mx-auto">
        {/* Hero Section */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          className="hero-box mb-16 md:mb-24 p-6 md:p-16 text-center"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] md:text-xs font-black uppercase tracking-[0.2em] mb-6">
            <Zap size={14} className="fill-current" /> Innovative Tech 2024
          </div>
          <h1 className="text-3xl md:text-6xl lg:text-7xl mb-6 font-black uppercase tracking-tighter leading-[0.9] text-white">
            Future-Proof <br className="hidden md:block" /> Your <span className="text-blue-500 decoration-blue-500/30 underline decoration-4 underline-offset-8">Lifestyle</span>
          </h1>
          <p className="text-slate-400 text-sm md:text-xl font-light mb-10 max-w-2xl mx-auto leading-relaxed">
            Discover the most advanced Amazon US essentials, expertly curated for the modern minimalist.
          </p>
          <div className="relative max-w-2xl mx-auto group">
             <input 
                type="text" 
                placeholder="Search products, gadgets, or smart tech..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 md:py-5 px-12 md:px-14 text-sm md:text-base text-white focus:ring-4 focus:ring-blue-500/20 outline-none transition-all placeholder:text-slate-600"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch(queryInput)}
             />
             <Search className="absolute left-4 md:left-6 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
             <div className="absolute top-1/2 -translate-y-1/2 right-2.5 md:right-3 flex items-center gap-2">
                <button 
                  onClick={() => handleSearch(queryInput)}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 md:px-8 md:py-3 rounded-xl transition-all shadow-lg shadow-blue-600/20 active:scale-95 text-[10px] md:text-xs font-black uppercase tracking-[0.1em]"
                >
                  Search
                </button>
             </div>
          </div>

        </motion.section>
        {/* Categories Section */}
        <section ref={categoriesSectionRef} className="mb-32 scroll-mt-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black uppercase tracking-tight text-white mb-2">BROWSE SMART CATEGORIES</h2>
            <p className="text-slate-400 text-sm font-light">Find the Perfect Tech for Every Corner of Your Life.</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-6">
            {CATEGORIES.map((cat, idx) => (
              <motion.div
                key={cat.id}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => handleSearch(cat.prompt)}
                className="glow-icon group cursor-pointer"
              >
                <div className={`transition-transform duration-500 group-hover:scale-110 ${cat.color}`}>
                  <cat.icon size={40} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white transition-colors">{cat.name}</span>
                <button className="bg-blue-600/80 hover:bg-blue-600 text-white text-[8px] font-black py-1.5 px-4 rounded-full opacity-100 translate-y-0 shadow-lg transition-all flex items-center gap-1 group-hover:bg-blue-500">
                  EXPLORE <ChevronRight size={10} />
                </button>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Product Grid */}
        <section ref={productsSectionRef} className="mb-32 scroll-mt-24">
          <div className="mb-12">
            <h2 className="text-2xl font-black uppercase tracking-tight text-white">Featured Products</h2>
          </div>

          {isSearching ? (
             <div className="flex flex-col items-center justify-center py-24 gap-4 animate-pulse">
                <Loader2 className="animate-spin text-blue-500" size={40} />
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Searching Amazon catalog...</p>
             </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {(products || Array(6).fill({})).map((product, idx) => (
                <motion.div
                  key={`${product.id}-${idx}`}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="product-card group cursor-pointer"
                  onClick={() => {
                    if(product.id) {
                      setSelectedProduct(product);
                      setView('product');
                      window.scrollTo({ top: 0, behavior: "instant" });
                    }
                  }}
                >
                  <div className="aspect-[16/9] bg-white p-6 relative overflow-hidden flex items-center justify-center">
                    {product.image_url ? (
                      <img 
                        src={product.image_url} 
                        alt={product.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-contain mix-blend-multiply group-hover:scale-110 transition-transform duration-700"
                      />
                    ) : (
                       <div className="w-full h-full bg-slate-100 animate-pulse" />
                    )}
                  </div>
                  
                  <div className="p-6 flex flex-col flex-1">
                    <h3 className="text-sm font-black text-white mb-1 uppercase tracking-tight truncate">
                      {product.name || "Loading product info..."}
                    </h3>
                    <p className="text-slate-500 text-[10px] mb-4 line-clamp-1 italic font-light">
                      {product.description || "Top rated electronic gadget available on Amazon US."}
                    </p>
                    
                    <div className="flex items-center justify-between mb-4">
                      <div className="star-rating">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} size={10} className={s <= Math.round(parseFloat(product.rating || "4.5")) ? "text-yellow-500 fill-yellow-500" : "text-slate-700"} />
                        ))}
                        <span className="text-[10px] text-slate-500 ml-1">({product.review_count || "234"})</span>
                      </div>
                      <span className="text-lg font-black text-white">{parsePrice(product.price).full}</span>
                    </div>

                    <a 
                      href={product.affiliate_link || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        e.stopPropagation();
                        product.id && logClick(product.id);
                      }}
                      className="amazon-btn"
                    >
                      Check Price on Amazon <ShoppingBag size={14} />
                    </a>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* Exclusive Deals */}
        <section ref={dealsSectionRef} className="mb-32 scroll-mt-24">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
            <div className="text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[10px] font-black uppercase tracking-[0.2em] mb-4">
                Flash Deals
              </div>
              <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-white">HOTTEST PRICE DROPS</h2>
            </div>
            <p className="text-slate-400 text-sm font-light max-w-sm">Limited Time Offers on Top Rated US Amazon Gadgets.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {(products?.slice(0, 3) || Array(3).fill({})).map((product, idx) => (
              <div 
                key={idx} 
                className="product-card cursor-pointer border-rose-500/20 hover:border-rose-500/50 hover:shadow-[0_0_30px_rgba(244,63,94,0.2)]"
                onClick={() => {
                  if(product.id) {
                    setSelectedProduct(product);
                    setView('product');
                    window.scrollTo({ top: 0, behavior: "instant" });
                  }
                }}
              >
                <div className="aspect-[16/9] bg-white p-6 flex items-center justify-center">
                  {product.image_url && <img src={product.image_url} referrerPolicy="no-referrer" className="w-full h-full object-contain mix-blend-multiply" />}
                </div>
                <div className="p-6 space-y-4">
                   <div>
                    <h3 className="text-sm font-black text-white uppercase truncate">{product.name || "Special Deal Title"}</h3>
                    <p className="text-rose-400 text-[10px] font-bold uppercase tracking-widest mt-1">Limited Offer</p>
                   </div>
                   <div className="flex justify-between items-center">
                      <div className="star-rating">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} size={10} fill="currentColor" />
                        ))}
                      </div>
                      <span className="text-white font-bold">{parsePrice(product.price).full}</span>
                   </div>
                   <button 
                     onClick={(e) => { 
                       e.stopPropagation();
                       if (product.id) {
                         logClick(product.id);
                         window.open(product.affiliate_link, '_blank');
                       }
                     }}
                     className="deals-btn uppercase"
                   >
                     View Deal on Amazon
                   </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* New Tech Section */}
        <section ref={newTechSectionRef} className="mb-32 scroll-mt-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black uppercase tracking-tight text-white mb-2">JUST ARRIVED: NEW TECH</h2>
            <p className="text-slate-400 text-sm font-light">Be the First to Experience the Newest Innovations for your Home.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {(products?.slice(3, 11) || Array(8).fill({})).map((product, idx) => (
              <div 
                key={idx} 
                className="product-card cursor-pointer border-blue-500/20"
                onClick={() => {
                  if(product.id) {
                    setSelectedProduct(product);
                    setView('product');
                    window.scrollTo({ top: 0, behavior: "instant" });
                  }
                }}
              >
                <div className="aspect-video bg-white p-4 relative flex items-center justify-center">
                  <div className="absolute top-2 right-2 px-2 py-0.5 bg-blue-600 text-white text-[8px] font-black rounded uppercase">NEW</div>
                  {product.image_url && <img src={product.image_url} referrerPolicy="no-referrer" className="w-full h-full object-contain mix-blend-multiply" />}
                </div>
                <div className="p-4 flex flex-col gap-3">
                  <h3 className="text-[11px] font-black text-white truncate">{product.name || "Latest Accessory"}</h3>
                  <div className="flex justify-between items-center">
                    <div className="star-rating">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} size={8} className={s <= Math.round(parseFloat(product.rating || "4.5")) ? "text-yellow-500 fill-yellow-500" : "text-slate-700"} />
                      ))}
                    </div>
                    <span className="text-white font-bold text-xs">{parsePrice(product.price).full}</span>
                  </div>
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation();
                      if (product.id) {
                        logClick(product.id);
                        window.open(product.affiliate_link, '_blank');
                      }
                    }}
                    className="amazon-btn py-2 text-[8px]"
                  >
                    Check Price on Amazon
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
      ) : view === 'admin' && isAdmin(user) ? (
        /* Admin Dashboard */
        <main className="pt-36 bg-[#050b18] min-h-screen px-4 pb-24 flex flex-col relative z-20">
            {/* Control Center Header */}
            <div className="max-w-7xl mx-auto w-full mb-8 relative">
               <div className="text-center pt-8 md:pt-12">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-[0.2em] mb-4">
                    Admin Dashboard
                  </div>
                  <h1 className="text-4xl md:text-6xl font-display font-black text-white tracking-tight uppercase mb-4">
                    Control Center
                  </h1>
                  <p className="text-slate-400 text-sm md:text-lg font-light">
                    Manage Products, View Analytics, and Control Store Settings.
                  </p>
                  <div className="mt-8 h-px max-w-2xl mx-auto bg-gradient-to-r from-transparent via-white/10 to-transparent" />
               </div>
            </div>

            <div className="max-w-7xl mx-auto w-full grid grid-cols-1 xl:grid-cols-2 gap-8 mb-12">
               {/* Analytics Overview */}
               <div className="bg-[#0a1120] border border-blue-500/20 rounded-[32px] p-6 md:p-8 shadow-2xl relative overflow-hidden">
                  <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-6">
                     <div>
                        <h3 className="text-xl font-bold text-white mb-1">Analytics Overview</h3>
                        <p className="text-xs text-slate-500 uppercase tracking-widest font-black">Success Performance</p>
                     </div>
                     <div className="flex flex-wrap gap-4">
                        <div className="text-right">
                           <p className="text-[10px] text-slate-500 uppercase font-black text-left md:text-right">Total Products:</p>
                           <p className="text-xl font-black text-white text-left md:text-right">{products?.length || 0}</p>
                        </div>
                        <div className="text-right border-l border-white/10 pl-4">
                           <p className="text-[10px] text-slate-500 uppercase font-black text-left md:text-right">Status:</p>
                           <p className="text-sm font-black text-emerald-400 text-left md:text-right">Active</p>
                        </div>
                        <div className="text-right border-l border-white/10 pl-4">
                           <p className="text-[10px] text-slate-500 uppercase font-black">Admin User:</p>
                           <p className="text-xs font-black text-white truncate max-w-[100px]">{user?.displayName || "Admin"}</p>
                        </div>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                     <div className="space-y-4">
                        <div className="flex justify-between items-end">
                           <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Traffic Overview</p>
                           <div className="flex gap-4 text-[10px] font-black text-slate-500 uppercase">
                              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500" /> Clicks</span>
                              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-orange-500" /> Sessions</span>
                           </div>
                        </div>
                        <div className="h-48 w-full bg-white/5 rounded-2xl p-4">
                           <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={TRAFFIC_DATA}>
                                 <defs>
                                    <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                                       <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                       <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                    </linearGradient>
                                 </defs>
                                 <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                 <XAxis dataKey="name" stroke="#64748b" fontSize={10} axisLine={false} tickLine={false} />
                                 <YAxis stroke="#64748b" fontSize={10} axisLine={false} tickLine={false} />
                                 <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #ffffff10", borderRadius: "12px", color: "#fff" }} />
                                 <Area type="monotone" dataKey="clicks" stroke="#3b82f6" fillOpacity={1} fill="url(#colorClicks)" strokeWidth={2} />
                                 <Area type="monotone" dataKey="sessions" stroke="#f97316" fill="transparent" strokeWidth={2} dot={{ r: 3, fill: "#f97316" }} />
                              </AreaChart>
                           </ResponsiveContainer>
                        </div>
                     </div>

                     <div className="space-y-4">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Revenue Snapshot (Last 30 Days)</p>
                        <div className="h-48 w-full bg-white/5 rounded-2xl p-4">
                           <ResponsiveContainer width="100%" height="100%">
                              <RechartsBarChart data={REVENUE_DATA}>
                                 <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                 <XAxis dataKey="name" stroke="#64748b" fontSize={8} axisLine={false} tickLine={false} />
                                 <YAxis stroke="#64748b" fontSize={8} axisLine={false} tickLine={false} />
                                 <Tooltip cursor={{ fill: "#ffffff05" }} contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #ffffff10", borderRadius: "12px" }} />
                                 <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                              </RechartsBarChart>
                           </ResponsiveContainer>
                        </div>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                     <div className="p-5 rounded-2xl bg-white/5 border border-white/5">
                        <p className="text-[10px] text-slate-500 uppercase font-black mb-1">Affiliate Link Clicks</p>
                        <p className="text-xs text-blue-400 font-black mb-4">Total: {stats.totalClicks || 1593}</p>
                        <div className="space-y-3">
                           <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase">
                              <span>Specific</span>
                              <span>{Math.round((stats.totalClicks || 1593) * 0.7)}</span>
                           </div>
                           <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500 w-[70%]" />
                           </div>
                           <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase">
                              <span>General</span>
                              <span>{Math.round((stats.totalClicks || 1593) * 0.3)}</span>
                           </div>
                           <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500 w-[30%]" />
                           </div>
                        </div>
                     </div>

                     <div className="p-5 rounded-2xl bg-white/5 border border-white/5 flex flex-col justify-between">
                        <div>
                           <p className="text-[10px] text-slate-500 uppercase font-black mb-1">Top Referrer</p>
                           <p className="text-xs text-slate-400 font-black">Amazon US</p>
                        </div>
                        <div className="text-4xl font-black text-white">78</div>
                        <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold">
                           <TrendingUp size={12} /> +12% this week
                        </div>
                     </div>

                     <div className="p-5 rounded-2xl bg-white/5 border border-white/5">
                        <p className="text-[10px] text-slate-500 uppercase font-black mb-2">Estimated Commissions</p>
                        <div className="h-20 w-full">
                           <ResponsiveContainer width="100%" height="100%">
                              <RechartsBarChart data={REVENUE_DATA.slice(-4)}>
                                 <Bar dataKey="value">
                                    {REVENUE_DATA.slice(-4).map((entry, index) => (
                                       <Cell key={`cell-${index}`} fill={index === 3 ? "#f59e0b" : "#3b82f6"} />
                                    ))}
                                 </Bar>
                              </RechartsBarChart>
                           </ResponsiveContainer>
                        </div>
                        <div className="flex justify-between items-end mt-2">
                           <span className="text-xs font-black text-white">$1,595.60</span>
                           <span className="text-[10px] text-slate-500 uppercase font-black">USD</span>
                        </div>
                     </div>
                  </div>
               </div>

               {/* Affiliate Tag Controller */}
               <div className="flex flex-col gap-8">
                  <div className="bg-[#0a1120] border border-blue-500/20 rounded-[32px] p-10 shadow-2xl relative overflow-hidden flex-1 group">
                     <div className="absolute top-0 right-0 p-8 text-blue-500/5 group-hover:text-blue-500/10 transition-colors">
                        <Zap size={140} strokeWidth={1} />
                     </div>
                     <div className="relative">
                        <h3 className="text-3xl font-black text-white mb-2 uppercase tracking-tight">Affiliate Tag Controller</h3>
                        <p className="text-sm text-slate-500 mb-10 max-w-sm">Manage and update your unique Amazon Associate Tag global configuration system.</p>
                        
                        <div className="bg-slate-950/50 border border-white/5 rounded-3xl p-8 space-y-6">
                           <div className="space-y-4">
                              <div className="flex justify-between items-center">
                                 <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Amazon Associate Tag</label>
                                 <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Connected</span>
                              </div>
                              <div className="flex gap-4">
                                 <input 
                                    type="text" 
                                    value={settings.affiliateTag}
                                    onChange={(e) => setSettings({ ...settings, affiliateTag: e.target.value })}
                                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-6 py-4 text-white font-mono text-sm focus:border-blue-500 outline-none transition-all"
                                    placeholder="YOUR_TAG-21"
                                 />
                                 <button className="px-6 py-4 bg-blue-600/10 border border-blue-500/30 text-blue-400 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all">
                                    Test Link
                                 </button>
                              </div>
                           </div>
                           <button 
                              onClick={() => saveSettings(settings)}
                              className="w-full py-5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-black text-sm uppercase tracking-widest shadow-xl shadow-orange-500/20 transition-all active:scale-95"
                           >
                              Save & Apply Globally
                           </button>
                        </div>
                     </div>
                  </div>

                  <div className="bg-[#0a1120] border border-blue-500/20 rounded-[32px] p-8 shadow-2xl">
                     <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-white">System Status</h3>
                        <CheckCircle2 size={20} className="text-emerald-400" />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                           <p className="text-[10px] text-slate-500 uppercase font-black mb-1">API Latency</p>
                           <p className="text-sm font-black text-white">124ms</p>
                        </div>
                        <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                           <p className="text-[10px] text-slate-500 uppercase font-black mb-1">Sync Frequency</p>
                           <p className="text-sm font-black text-white">Every 6h</p>
                        </div>
                     </div>
                  </div>
               </div>
            </div>

            <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
               {/* Product Catalog Manager */}
               <div className="lg:col-span-1 bg-[#0a1120] border border-blue-500/20 rounded-[32px] p-8 shadow-2xl flex flex-col">
                  <div className="flex justify-between items-center mb-8">
                     <div>
                        <h3 className="text-2xl font-black text-white uppercase tracking-tight">Product Catalog Manager</h3>
                        <p className="text-xs text-slate-500 uppercase font-black tracking-widest mt-1">Edit, Update, and Sync Inventory</p>
                     </div>
                     <div className="flex gap-3 flex-wrap">
                        <button 
                           onClick={() => {
                             setManualProduct({
                               name: "",
                               brand: "",
                               price: "",
                               asin: "",
                               category: "Smart Home",
                               image_url: "",
                               affiliate_link: "",
                               description: "",
                               highlights: [],
                               description_bullets: [],
                               video_url: "",
                               images: [],
                               id: undefined
                             });
                             setIsManualAdding(true);
                           }}
                           className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-black text-[10px] uppercase tracking-widest transition-all"
                        >
                           <Plus size={16} /> Manual Entry
                        </button>
                     </div>
                  </div>

                  {/* Manual Add Form or Table */}
                  {isManualAdding ? (
                     <div className="flex-1 bg-white/5 border border-white/5 rounded-3xl p-6 md:p-8 space-y-6 overflow-y-auto max-h-[600px] text-left">
                        <div className="flex justify-between items-center pb-4 border-b border-white/5">
                           <h4 className="text-white font-black uppercase text-sm tracking-[0.2em] flex items-center gap-2">
                              {manualProduct.id ? <SettingsIcon className="text-blue-500" size={18} /> : <Plus className="text-emerald-500" size={18} />}
                              {manualProduct.id ? "Edit Product Details" : "New Product Details"}
                           </h4>
                           <button onClick={() => setIsManualAdding(false)} className="p-2 hover:bg-white/5 rounded-lg text-slate-500 hover:text-white transition-all">
                              <X size={20} />
                           </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <div className="space-y-4">
                              <div className="space-y-1.5">
                                 <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Product Name *</label>
                                 <input 
                                    type="text" 
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-emerald-500/50 transition-all font-light"
                                    placeholder="e.g. Sony WH-1000XM5"
                                    value={manualProduct.name}
                                    onChange={(e) => setManualProduct({...manualProduct, name: e.target.value})}
                                 />
                              </div>
                              <div className="space-y-1.5">
                                 <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Main Image URL *</label>
                                 <input 
                                    type="text" 
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-emerald-500/50 transition-all font-light"
                                    placeholder="https://..."
                                    value={manualProduct.image_url}
                                    onChange={(e) => setManualProduct({...manualProduct, image_url: e.target.value})}
                                 />
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                 <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Price ($)*</label>
                                    <input 
                                       type="text" 
                                       className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-emerald-500/50 transition-all"
                                       placeholder="299.00"
                                       value={manualProduct.price}
                                       onChange={(e) => setManualProduct({...manualProduct, price: e.target.value})}
                                    />
                                 </div>
                                 <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Category</label>
                                    <select 
                                       className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-emerald-500/50 transition-all"
                                       value={manualProduct.category}
                                       onChange={(e) => setManualProduct({...manualProduct, category: e.target.value})}
                                    >
                                       <option value="Smart Home">Smart Home</option>
                                       <option value="Kitchen">Kitchen</option>
                                       <option value="Pet">Pet</option>
                                       <option value="Mobile">Mobile</option>
                                    </select>
                                 </div>
                              </div>
                           </div>

                           <div className="space-y-4">
                              <div className="space-y-1.5">
                                 <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Affiliate Link *</label>
                                 <input 
                                    type="text" 
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-emerald-500/50 transition-all font-light"
                                    placeholder="https://amzn.to/..."
                                    value={manualProduct.affiliate_link}
                                    onChange={(e) => setManualProduct({...manualProduct, affiliate_link: e.target.value})}
                                 />
                              </div>
                              <div className="space-y-1.5">
                                 <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Video URL (Optional)</label>
                                 <input 
                                    type="text" 
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-emerald-500/50 transition-all font-light"
                                    placeholder="https://youtube.com/..."
                                    value={manualProduct.video_url}
                                    onChange={(e) => setManualProduct({...manualProduct, video_url: e.target.value})}
                                 />
                              </div>
                              <div className="space-y-1.5">
                                 <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Description</label>
                                 <textarea 
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-emerald-500/50 transition-all h-20 resize-none font-light leading-relaxed"
                                    placeholder="Product description summary..."
                                    value={manualProduct.description}
                                    onChange={(e) => setManualProduct({...manualProduct, description: e.target.value})}
                                 />
                              </div>
                           </div>
                        </div>

                        <div className="space-y-4 pt-6 border-t border-white/5">
                           <div className="flex justify-between items-center">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Additional Photos (Max 10)</label>
                              <label className="cursor-pointer bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase text-white transition-all flex items-center gap-2">
                                 <ImagePlus size={14} /> Upload
                                 <input 
                                    type="file" 
                                    multiple 
                                    accept="image/*" 
                                    className="hidden" 
                                    onChange={handleImageUpload}
                                 />
                              </label>
                           </div>
                           
                           <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                              {manualProduct.images?.map((img, idx) => (
                                 <div key={idx} className="relative aspect-square bg-slate-950 rounded-xl border border-white/10 overflow-hidden group">
                                    <img src={img} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                                    <button 
                                       onClick={() => setManualProduct(prev => ({ ...prev, images: prev.images?.filter((_, i) => i !== idx) }))}
                                       className="absolute inset-0 bg-rose-600/80 items-center justify-center hidden group-hover:flex text-white transition-all"
                                    >
                                       <Trash2 size={16} />
                                    </button>
                                 </div>
                              ))}
                              {(!manualProduct.images || manualProduct.images.length < 10) && (
                                 <button 
                                    onClick={() => {
                                       const url = prompt("Enter Image URL:");
                                       if (url) setManualProduct(prev => ({ ...prev, images: [...(prev.images || []), url] }));
                                    }}
                                    className="aspect-square bg-slate-950 border-2 border-dashed border-white/10 rounded-xl flex items-center justify-center text-slate-500 hover:text-white hover:border-white/20 transition-all"
                                 >
                                    <Plus size={20} />
                                 </button>
                              )}
                           </div>
                        </div>

                        <div className="pt-6 border-t border-white/5 flex gap-4">
                           <button 
                              onClick={handleManualAdd}
                              className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-600/20 transition-all"
                           >
                              Save Product
                           </button>
                        </div>
                     </div>
                  ) : (
                     <>
                        <div className="flex-1 overflow-x-auto text-left">
                           <table className="w-full text-left">
                              <thead>
                                 <tr className="border-b border-white/5 text-[10px] font-black uppercase text-slate-500 tracking-widest">
                                    <th className="pb-4 pr-4">Image</th>
                                    <th className="pb-4 pr-4">Product Title</th>
                                    <th className="pb-4 pr-4">ASIN</th>
                                    <th className="pb-4 pr-4">Price ($)</th>
                                    <th className="pb-4 pr-4">Star Rating</th>
                                    <th className="pb-4">Actions</th>
                                 </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5">
                                 {(currentItems || Array(5).fill({})).map((p, i) => (
                                    <tr key={i} className="group hover:bg-white/5 transition-colors">
                                       <td className="py-4 pr-4">
                                          <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center p-1 overflow-hidden shadow-lg border border-white/5">
                                             <img src={p.image_url || "https://placehold.co/100x100"} referrerPolicy="no-referrer" className="w-full h-full object-contain mix-blend-multiply" />
                                          </div>
                                       </td>
                                       <td className="py-4 pr-4 max-w-[200px] truncate text-xs font-bold text-white">{p.name || "Sample Product name..."}</td>
                                       <td className="py-4 pr-4 text-[10px] font-mono text-slate-500">{p.asin || "MANUAL"}</td>
                                       <td className="py-4 pr-4 text-xs font-black text-white">${p.price || "49.99"}</td>
                                       <td className="py-4 pr-4">
                                          <div className="star-rating text-[8px]">
                                             {[1, 2, 3, 4, 5].map((s) => (
                                                <Star key={s} size={8} className={s <= Math.round(parseFloat(p.rating || "4.5")) ? "text-orange-400 fill-orange-400" : "text-slate-200 fill-slate-200"} />
                                             ))}
                                          </div>
                                       </td>
                                       <td className="py-4">
                                          <div className="flex gap-2">
                                             <button onClick={() => { setSelectedProduct(p); setView('product'); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="p-2 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-all" title="View"><Eye size={14} /></button>
                                             <button onClick={() => handleEditProduct(p)} className="p-2 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-all" title="Edit"><SettingsIcon size={14} /></button>
                                             <button onClick={() => deleteProduct(p.id || p.asin)} className="p-2 hover:bg-rose-500/20 text-rose-500 rounded-lg transition-all" title="Delete"><Trash2 size={14} /></button>
                                          </div>
                                       </td>
                                    </tr>
                                 ))}
                              </tbody>
                           </table>
                        </div>
                        
                        <div className="flex justify-between items-center pt-6 border-t border-white/5">
                           <p className="text-[10px] font-black text-slate-500 uppercase">Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, products?.length || 0)} of {products?.length || 0} entries</p>
                           <div className="flex gap-2">
                              <button 
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${currentPage === 1 ? "bg-white/5 text-slate-600" : "bg-white/5 text-slate-400 hover:bg-white/10"}`}
                              >
                                Prev
                              </button>
                              <button 
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${currentPage === totalPages ? "bg-white/5 text-slate-600" : "bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20"}`}
                              >
                                Next
                              </button>
                           </div>
                        </div>
                     </>
                  )}
            </div>

               <div className="bg-[#0a1120] border border-blue-500/20 rounded-[32px] p-8 shadow-2xl flex flex-col">
                  <div className="text-center mb-10">
                     <h3 className="text-2xl font-black text-white uppercase tracking-tight">Category & Offers Sync</h3>
                     <p className="text-xs text-slate-500 uppercase font-black tracking-widest mt-1">AI-Powered Niche Targeting</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1">
                     <div className="space-y-6">
                        <div className="flex justify-between items-center">
                           <h4 className="text-sm font-bold text-white">Category Management</h4>
                           <div className="flex gap-2 p-1 bg-white/5 border border-white/10 rounded-lg text-[8px] font-black uppercase">
                              <button className="px-3 py-1.5 bg-blue-600 rounded-md text-white">Enable</button>
                              <button className="px-3 py-1.5 rounded-md text-slate-500 hover:text-white">Disable</button>
                           </div>
                        </div>
                        <div className="space-y-3">
                           {CATEGORIES.slice(0, 4).map(cat => (
                              <div key={cat.id} className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl group hover:border-blue-500/30 transition-all">
                                 <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg bg-white/5 ${cat.color}`}><cat.icon size={16} /></div>
                                    <span className="text-xs font-bold text-white">{cat.name}</span>
                                 </div>
                                 <div className="w-10 h-5 bg-blue-600 rounded-full relative p-1 cursor-pointer">
                                    <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full" />
                                 </div>
                              </div>
                           ))}
                        </div>
                     </div>

                     <div className="space-y-6">
                        <h4 className="text-sm font-bold text-white">Deals Synchronization</h4>
                        <div className="space-y-4">
                           <div className="p-6 bg-slate-950/50 border border-white/5 rounded-2xl flex flex-col gap-4">
                              <div className="flex justify-between items-start">
                                 <p className="text-[10px] font-black text-slate-500 uppercase leading-relaxed">Connect deals to current offers for rotations and stale entries.</p>
                                 <RefreshCw size={14} className="text-blue-400 animate-spin-slow" />
                              </div>
                              <button className="text-[10px] font-black text-blue-400 flex items-center gap-1 hover:translate-x-1 transition-all">
                                 CONFIG SYNC <ChevronRight size={10} />
                              </button>
                           </div>
                           
                           <div className="p-6 bg-white/5 border border-white/5 rounded-2xl flex flex-col gap-2">
                              <p className="text-[10px] font-black text-white uppercase">Last Synchronization</p>
                              <div className="flex items-center gap-2">
                                 <div className="w-2 h-2 rounded-full bg-emerald-400" />
                                 <span className="text-xs font-mono text-slate-400">Today, 04:22 PM</span>
                              </div>
                              <div className="pt-4 flex items-center justify-between">
                                 <span className="text-[10px] font-black text-slate-500 uppercase">Status: Success</span>
                                 <TrendingUp size={14} className="text-emerald-400" />
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
        </main>
      ) : (
        /* Amazon Style Product Detail Page */
        <main className="pt-36 bg-[#f8f9fa] min-h-screen">
          <div className="max-w-[1500px] mx-auto px-4 md:px-8">
            {/* Breadcrumbs */}
            <nav className="flex items-center gap-2 text-[10px] md:text-sm text-slate-500 mb-8 py-3 overflow-x-auto whitespace-nowrap scrollbar-hide border-b border-slate-100">
               <button onClick={() => { setView('home'); setSelectedProduct(null); }} className="hover:text-blue-600 flex items-center gap-1.5 transition-colors font-bold">
                 <Home size={14} className="shrink-0" /> Smart Store
               </button>
               <ChevronRight size={12} className="shrink-0 opacity-40" />
               <button onClick={() => { setView('home'); setSelectedProduct(null); }} className="hover:text-blue-600 transition-colors font-bold">Electronics</button>
               <ChevronRight size={12} className="shrink-0 opacity-40" />
               <span className="text-slate-400 truncate max-w-[200px] md:max-w-none">{selectedProduct?.name}</span>
            </nav>

            <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 bg-white rounded-3xl p-6 md:p-10 shadow-sm border border-slate-100 mb-12">
               {/* Left: Images */}
               <div className="lg:w-[45%] flex flex-col md:flex-row gap-6">
                  <div className="hidden md:flex flex-col gap-4 shrink-0 max-h-[550px] overflow-y-auto pr-2 scrollbar-hide">
                     {[selectedProduct?.image_url, ...(selectedProduct?.images || [])].filter(Boolean).map((img, i) => (
                       <div 
                         key={i} 
                         onMouseEnter={() => setMainImage(img as string)}
                         className={`w-16 h-16 border ${mainImage === img ? "border-orange-500 ring-2 ring-orange-500/10 shadow-sm" : "border-slate-100"} rounded-xl p-2 cursor-pointer hover:border-orange-500 transition-all bg-white flex items-center justify-center overflow-hidden`}
                       >
                           <img src={img as string} referrerPolicy="no-referrer" className="max-w-full max-h-full object-contain mix-blend-multiply" />
                       </div>
                     ))}
                  </div>
                  <div className="flex-1 flex items-center justify-center bg-white border border-slate-50 rounded-2xl p-6 md:p-12 min-h-[350px] md:min-h-[550px] group relative overflow-hidden">
                     <img src={mainImage || selectedProduct?.image_url} alt={selectedProduct?.name} referrerPolicy="no-referrer" className="max-w-full max-h-[300px] md:max-h-[500px] object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-500" />
                     <div className="absolute top-4 right-4 flex flex-col gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-3 bg-white border border-slate-200 rounded-full shadow-lg text-slate-600 hover:text-rose-500 hover:scale-110 transition-all"><Heart size={20} /></button>
                        <button className="p-3 bg-white border border-slate-200 rounded-full shadow-lg text-slate-600 hover:text-blue-500 hover:scale-110 transition-all"><Share2 size={20} /></button>
                     </div>
                  </div>
               </div>

               {/* Right: Info & Buy Box */}
               <div className="flex-1 flex flex-col xl:flex-row gap-10">
                  {/* Center: Info */}
                  <div className="xl:flex-1 space-y-8">
                     <div className="space-y-4">
                       <h1 className="text-2xl md:text-3xl font-display font-black text-slate-900 leading-tight">
                         {selectedProduct?.name}
                       </h1>
                       <div className="flex items-center gap-3 flex-wrap">
                          <p className="px-2 py-1 bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest rounded border border-blue-100">{selectedProduct?.brand || "Official Store"}</p>
                          <span className="text-slate-300">|</span>
                          <div className="flex items-center gap-2">
                             <div className="flex items-center">
                                {[1,2,3,4,5].map(s => <Star key={s} size={16} className={s <= Math.round(parseFloat(selectedProduct?.rating || "4.5")) ? "text-orange-400 fill-orange-400" : "text-slate-200 fill-slate-200"} />)}
                             </div>
                             <span className="text-blue-600 text-xs font-bold hover:underline cursor-pointer">{selectedProduct?.review_count || "12,450 ratings"}</span>
                          </div>
                       </div>
                     </div>

                     <div className="h-px bg-slate-100" />

                     <div className="space-y-6">
                        <div className="flex flex-col gap-2">
                           <div className="flex items-baseline gap-3">
                              {selectedProduct?.discount_percentage && (
                                <span className="text-rose-600 text-4xl font-light tracking-tighter">-{selectedProduct.discount_percentage}</span>
                              )}
                              <div className="flex items-baseline gap-1">
                                 <span className="text-sm text-slate-900 font-black self-start mt-2">$</span>
                                 <span className="text-5xl font-black text-slate-900 tracking-tighter">{parsePrice(selectedProduct?.price).whole}</span>
                                 <span className="text-sm text-slate-900 font-black self-start mt-2">{parsePrice(selectedProduct?.price).fraction}</span>
                              </div>
                           </div>
                           <div className="flex items-center gap-2">
                             <p className="text-[10px] uppercase font-black text-slate-400 tracking-[0.2em]">List Price: <span className="line-through">$59.99</span></p>
                             <div className="group relative">
                               <Info size={12} className="text-slate-300 cursor-help" />
                               <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-900 text-white text-[9px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                 The List Price is the suggested retail price. Prices on Amazon are subject to change.
                               </div>
                             </div>
                           </div>
                        </div>
                        
                         <div className="flex flex-wrap gap-3">
                          {selectedProduct?.trust_badge && (
                            <div className="bg-orange-600/10 border border-orange-600/20 rounded-lg px-4 py-2 inline-flex items-center gap-2">
                               <Zap size={14} className="text-orange-600 fill-orange-600" />
                               <span className="text-orange-700 font-black text-[10px] uppercase tracking-widest whitespace-nowrap">#{selectedProduct.trust_badge}</span>
                            </div>
                          )}
                          <div className="bg-blue-600/10 border border-blue-600/20 rounded-lg px-4 py-2 inline-flex items-center gap-2">
                             <ShieldCheck size={14} className="text-blue-600" />
                             <span className="text-blue-700 font-black text-[10px] uppercase tracking-widest whitespace-nowrap">Amazon's Choice</span>
                          </div>
                        </div>

                        <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white shrink-0">
                             <TrendingUp size={16} />
                           </div>
                           <div>
                              <p className="text-xs font-black text-emerald-800 uppercase tracking-tight">Highly Popular</p>
                              <p className="text-[10px] text-emerald-600 font-medium leading-tight">5,000+ items sold on Amazon US last month</p>
                           </div>
                        </div>
                     </div>

                     <div className="space-y-6 pt-8 border-t border-slate-100">
                        <h3 className="font-black text-slate-900 text-xs uppercase tracking-[0.2em] mb-4">Core Specifications</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                           {(selectedProduct?.highlights || [
                              { label: 'Color', value: 'Graphite Black' },
                              { label: 'Brand', value: selectedProduct?.brand || 'Premium' },
                              { label: 'Connectivity', value: 'Smart WiFi' },
                              { label: 'Warranty', value: '12 Months' }
                           ]).map((feat: any, i) => (
                              <div key={i} className="flex flex-col p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                 <span className="text-[9px] text-slate-400 font-black uppercase tracking-tighter mb-1">{feat.label}</span>
                                 <span className="text-xs text-slate-900 font-black truncate">{feat.value}</span>
                              </div>
                           ))}
                        </div>
                        <div className="pt-6 space-y-4">
                           <h3 className="font-black text-slate-900 text-xs uppercase tracking-[0.2em]">About this item</h3>
                           <ul className="space-y-4 text-xs text-slate-600 leading-relaxed font-medium">
                              {(selectedProduct?.description_bullets || (selectedProduct?.description || "").split('.').filter(s => s.trim())).map((desc, i) => (
                                 <li key={i} className="flex gap-3">
                                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                                    <span>{desc.trim()}.</span>
                                 </li>
                              ))}
                           </ul>
                        </div>
                     </div>
                  </div>

                  {/* Buy Box - Sticky on Desktop */}
                  <div className="xl:w-[380px] shrink-0">
                     <div className="border-2 border-slate-100 rounded-3xl p-8 space-y-8 bg-white sticky top-28 shadow-2xl shadow-slate-200/50">
                        <div className="space-y-6">
                           <div className="flex items-baseline gap-1">
                              <span className="text-sm text-slate-900 font-black">$</span>
                              <span className="text-4xl font-black text-slate-900 tracking-tighter">{parsePrice(selectedProduct?.price).whole}.{parsePrice(selectedProduct?.price).fraction}</span>
                           </div>
                           <div className="space-y-3">
                              <p className="text-xs text-blue-600 font-black flex items-center gap-2 hover:bg-blue-50 px-2 py-1 rounded transition-colors w-fit -ml-2 cursor-pointer"><ShieldCheck size={16} /> FREE Returns</p>
                              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                                 <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center">
                                       <Truck size={12} className="text-white" />
                                    </div>
                                    <p className="text-xs text-slate-900 font-bold">
                                       FREE delivery <span className="text-blue-600">Monday, Oct 25</span>
                                    </p>
                                 </div>
                                 <div className="flex items-center gap-2 pl-7">
                                    <span className="bg-blue-100 text-blue-700 text-[8px] font-black px-1.5 py-0.5 rounded italic">prime</span>
                                    <p className="text-[10px] text-slate-500 font-medium">Included with your membership</p>
                                 </div>
                                 <p className="text-[10px] text-slate-500 uppercase font-black pl-7">Order within <span className="text-emerald-600 font-black italic">12 hrs 32 mins</span></p>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-2 pt-2">
                                 <div className="flex flex-col items-center gap-1 p-2 bg-slate-50 rounded-xl border border-slate-100">
                                    <RotateCcw size={14} className="text-slate-400" />
                                    <span className="text-[9px] font-bold text-slate-500 uppercase">30-Day Return</span>
                                 </div>
                                 <div className="flex flex-col items-center gap-1 p-2 bg-slate-50 rounded-xl border border-slate-100">
                                    <ShieldCheck size={14} className="text-slate-400" />
                                    <span className="text-[9px] font-bold text-slate-500 uppercase">Secure Pay</span>
                                 </div>
                              </div>
                              <button className="flex items-center gap-2 text-blue-600 text-xs font-black uppercase tracking-widest hover:underline pt-2">
                                 <MapPin size={14} className="text-rose-500" /> Deliver to Bangladesh
                              </button>
                           </div>
                        </div>

                        <div className="flex items-center gap-2">
                           <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                           <span className="text-emerald-700 font-black text-sm uppercase tracking-widest">In Stock</span>
                        </div>

                        <div className="space-y-4">
                           <button className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 px-5 flex items-center justify-between text-xs font-black text-slate-900 hover:bg-slate-100 hover:border-slate-200 transition-all">
                              <span className="uppercase tracking-widest">Quantity: 1</span>
                              <ChevronDown size={16} />
                           </button>
                           
                           <div className="grid gap-3">
                              <a 
                                href={selectedProduct?.affiliate_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => selectedProduct && logClick(selectedProduct.id)}
                                className="w-full h-14 bg-[#FFD814] hover:bg-[#F7CA00] text-slate-900 rounded-2xl shadow-lg shadow-yellow-500/20 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                              >
                                 View on Amazon
                              </a>
                              <a 
                                href={selectedProduct?.affiliate_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => selectedProduct && logClick(selectedProduct.id)}
                                className="w-full h-14 bg-[#FFA41C] hover:bg-[#FA8900] text-white rounded-2xl shadow-lg shadow-orange-500/20 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                              >
                                 <ExternalLink size={14} /> Buy Now on Amazon
                              </a>
                           </div>
                           <p className="text-[9px] text-slate-400 text-center font-medium leading-tight">
                              You will be redirected to Amazon.com to complete your secure purchase.
                           </p>
                        </div>

                        <div className="space-y-3 pt-6 border-t border-slate-100">
                           <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              <span>Ships from</span>
                              <span className="flex items-center gap-1.5 text-slate-900">
                                <Truck size={12} className="text-blue-500" /> Amazon.com
                              </span>
                           </div>
                           <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              <span>Sold by</span>
                              <span className="text-slate-900 font-black text-blue-600 hover:underline cursor-pointer">SmartStore_USA</span>
                           </div>
                           <div className="pt-2 flex items-center justify-center gap-2 bg-slate-50 py-2 rounded-xl border border-slate-100">
                             <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Verified Link</span>
                             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                             <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Amazon Official Affiliate</span>
                           </div>
                        </div>

                        {/* Marketing Strategy Tool */}
                        <div className="pt-6 border-t border-slate-100">
                           <button 
                             onClick={handleGenerateStrategy}
                             disabled={isGeneratingStrategy}
                             className="w-full py-4 bg-slate-950 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:bg-slate-900 transition-all disabled:opacity-50 shadow-xl"
                           >
                             {isGeneratingStrategy ? (
                               <><Loader2 size={14} className="animate-spin" /> Analyzing Strategy...</>
                             ) : (
                               <><LucideBarChart size={14} /> Pinterest & Content Strategy</>
                             )}
                           </button>
                        </div>

                        <div className="pt-4">
                           <button className="w-full py-4 border-2 border-slate-100 rounded-2xl text-[10px] font-black text-slate-500 hover:bg-slate-50 hover:text-slate-900 uppercase tracking-[0.2em] transition-all">Add to Wishlist</button>
                        </div>
                     </div>
                  </div>
               </div>
            </div>

            {/* Video Section */}
            {selectedProduct?.video_url && (
              <div className="bg-white rounded-3xl p-6 md:p-10 shadow-sm border border-slate-100 mb-12 text-left">
                 <div className="flex items-center gap-4 mb-8">
                    <div className="w-10 h-10 bg-rose-500 rounded-xl flex items-center justify-center text-white">
                       <Play size={20} fill="currentColor" />
                    </div>
                    <div>
                       <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Product Video Showcase</h3>
                       <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Experience the product in action</p>
                    </div>
                 </div>
                 <div className="aspect-video w-full rounded-2xl overflow-hidden bg-slate-950 shadow-2xl relative group">
                    <iframe 
                       src={selectedProduct.video_url.includes('youtube.com') || selectedProduct.video_url.includes('youtu.be') 
                         ? `https://www.youtube.com/embed/${selectedProduct.video_url.split('v=')[1] || selectedProduct.video_url.split('/').pop()}`
                         : selectedProduct.video_url
                       }
                       className="w-full h-full border-0"
                       allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                       allowFullScreen
                    ></iframe>
                 </div>
              </div>
            )}
          </div>

          {/* Marketing Content Display */}
          <AnimatePresence>
            {marketingStrategy && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="max-w-[1500px] mx-auto px-4 md:px-8 mb-12"
              >
                <div className="bg-slate-900 text-white rounded-3xl p-8 md:p-12 shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none transform translate-x-1/2 -translate-y-1/2">
                    < LucideBarChart size={400} />
                  </div>
                  
                  <div className="flex justify-between items-center mb-8 relative z-10">
                    <div>
                      <h2 className="text-2xl font-black uppercase tracking-tight mb-1">Marketing & Content Hub</h2>
                      <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Pinterest & Affiliate Strategy Generated by AI</p>
                    </div>
                    <button 
                      onClick={() => setMarketingStrategy(null)}
                      className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12 relative z-10">
                    <div className="space-y-8">
                       {marketingStrategy.split('\n\n').map((section, idx) => (
                         <div key={idx} className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-blue-500/50 transition-all">
                            <div className="whitespace-pre-wrap text-sm text-slate-300 leading-relaxed font-light">
                              {section}
                            </div>
                         </div>
                       ))}
                    </div>
                    
                    <div className="space-y-6">
                      <div className="p-6 bg-blue-600 rounded-2xl shadow-xl shadow-blue-600/20">
                        <h4 className="font-black uppercase tracking-widest text-xs mb-4">Quick Tip for Pinterest</h4>
                        <p className="text-sm font-light leading-relaxed">
                          Always use high-quality 2:3 aspect ratio images. For this product, the "Lifestyle" shot with a human element usually performs 40% better on Pinterest than standard white-background catalog shots.
                        </p>
                      </div>
                      
                      <div className="p-6 bg-slate-800 rounded-2xl border border-white/5">
                        <h4 className="font-black uppercase tracking-widest text-[10px] text-slate-400 mb-4">Affiliate Conversion Advice</h4>
                        <p className="text-xs text-slate-400 font-light leading-relaxed">
                          Mentioning "Limited Time" or "Stock availability for US shipping" often drives urgency. Ensure your affiliate disclosure is clear to maintain trust.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Floating Mobile Purchase Button */}
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t border-slate-100 lg:hidden z-[60] flex gap-3 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
             <button 
                onClick={() => { setView('home'); setSelectedProduct(null); }}
                className="w-14 h-14 flex items-center justify-center border-2 border-slate-100 rounded-2xl text-slate-400 bg-white hover:text-slate-900 transition-colors"
             >
                <X size={24} />
             </button>
             <a 
               href={selectedProduct?.affiliate_link}
               target="_blank"
               rel="noopener noreferrer"
               className="flex-1 h-14 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] flex items-center justify-center shadow-2xl shadow-blue-600/20 active:scale-95 transition-all"
             >
                Real-time Amazon Pricing
             </a>
          </div>

          <div className="max-w-[1500px] mx-auto px-4 md:px-8 mb-12">
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Amazon Trust Section */}
                <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
                   <h3 className="text-xl font-display font-black text-slate-900 mb-6 uppercase tracking-tight">Why Shop via Smart Store?</h3>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="flex gap-4">
                         <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                            <ShieldCheck size={20} />
                         </div>
                         <div>
                            <p className="text-sm font-bold text-slate-900">Secure Payment</p>
                            <p className="text-xs text-slate-500 leading-relaxed">Transactions are processed directly by Amazon's world-class secure system.</p>
                         </div>
                      </div>
                      <div className="flex gap-4">
                         <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-600 shrink-0">
                            <Truck size={20} />
                         </div>
                         <div>
                            <p className="text-sm font-bold text-slate-900">Tracked Shipping</p>
                            <p className="text-xs text-slate-500 leading-relaxed">Real-time tracking and reliable global delivery by Amazon Logistics.</p>
                         </div>
                      </div>
                      <div className="flex gap-4">
                         <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                            <RotateCcw size={20} />
                         </div>
                         <div>
                            <p className="text-sm font-bold text-slate-900">Easy Returns</p>
                            <p className="text-xs text-slate-500 leading-relaxed">Shop with confidence with Amazon's hassle-free return policy.</p>
                         </div>
                      </div>
                      <div className="flex gap-4">
                         <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
                            <ExternalLink size={20} />
                         </div>
                         <div>
                            <p className="text-sm font-bold text-slate-900">Official Warranty</p>
                            <p className="text-xs text-slate-500 leading-relaxed">Get valid manufacturer warranty directly when purchasing via Amazon.</p>
                         </div>
                      </div>
                   </div>
                </div>

                {/* Review Highlights */}
                <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
                   <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-display font-black text-slate-900 uppercase tracking-tight">Amazon Review Snippets</h3>
                      <div className="flex items-center gap-1">
                         <p className="text-xs font-bold text-slate-900 mr-2">4.8 / 5</p>
                         {[1,2,3,4,5].map(s => <Star key={s} size={12} className="text-orange-400 fill-orange-400" />)}
                      </div>
                   </div>
                   <div className="space-y-6">
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                         <div className="flex items-center gap-2 mb-2">
                            <div className="w-6 h-6 rounded-full bg-slate-200" />
                            <span className="text-[10px] font-bold text-slate-900">Verified Customer</span>
                            <span className="text-[10px] text-slate-400">• Oct 2024</span>
                         </div>
                         <p className="text-xs text-slate-600 italic leading-relaxed">"Absolutely exceeded my expectations. The smart integration is seamless and it feels like a premium device. Highly recommended for any tech enthusiast!"</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                         <div className="flex items-center gap-2 mb-2">
                            <div className="w-6 h-6 rounded-full bg-slate-200" />
                            <span className="text-[10px] font-bold text-slate-900">Tech Insider</span>
                            <span className="text-[10px] text-slate-400">• Sep 2024</span>
                         </div>
                         <p className="text-xs text-slate-600 italic leading-relaxed">"Best value for money in the market right now. The feature set matches devices twice its price. A total game changer for my smart home."</p>
                      </div>
                   </div>
                </div>
             </div>
          </div>

          <div className="max-w-[1500px] mx-auto px-4 md:px-8 mb-20">
             <div className="p-6 bg-slate-100 rounded-2xl border border-slate-200">
                <p className="text-[10px] text-slate-500 font-medium leading-relaxed text-center italic">
                   Disclosure: As an Amazon Associate, Smart Store earns from qualifying purchases. When you click on links to various merchants on this site and make a purchase, this can result in this site earning a commission. Affiliate programs and affiliations include, but are not limited to, the Amazon Associates Program.
                </p>
             </div>
          </div>

          {/* Related Products Section */}
          <div className="max-w-[1500px] mx-auto px-4 md:px-8 mb-20">
            <div className="flex items-center gap-4 mb-8">
              <h2 className="text-xl font-display font-black text-slate-900 uppercase tracking-tight">More Items You Might Like</h2>
              <div className="h-px flex-1 bg-slate-100" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {(products?.filter(p => p.id !== selectedProduct?.id).slice(0, 5) || Array(5).fill({})).map((product, idx) => (
                <div 
                  key={idx} 
                  className="bg-white border border-slate-100 rounded-2xl p-4 hover:shadow-xl transition-all group cursor-pointer"
                  onClick={() => {
                    if (product.id) {
                      setSelectedProduct(product);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                  }}
                >
                  <div className="aspect-square bg-slate-50 rounded-xl mb-4 p-4 flex items-center justify-center">
                    {product.image_url && <img src={product.image_url} alt={product.name} referrerPolicy="no-referrer" className="max-w-full max-h-full object-contain mix-blend-multiply group-hover:scale-110 transition-transform" />}
                  </div>
                  <h3 className="text-[11px] font-bold text-slate-900 truncate mb-1">{product.name || "Loading item..."}</h3>
                  <div className="flex items-center gap-1 mb-2">
                    {[1,2,3,4,5].map(s => <Star key={s} size={10} className="text-orange-400 fill-orange-400" />)}
                  </div>
                  <p className="text-sm font-black text-slate-900">{parsePrice(product.price).full}</p>
                </div>
              ))}
            </div>
          </div>
        </main>
      )}

      {/* Footer */}
      <footer className="relative z-10 py-24 bg-slate-950/80 backdrop-blur-xl border-t border-white/5 mt-40">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-16 mb-20 text-white">
            <div className="md:col-span-2 space-y-8">
              <div className="flex items-center gap-3 mb-12">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center transform rotate-12 shadow-lg shadow-blue-500/20">
                  <ShoppingBag size={22} className="text-white" />
                </div>
                <span className="text-2xl font-display font-black text-white tracking-tight uppercase">Smart Gadget Store</span>
              </div>
              <p className="text-slate-400 text-lg leading-relaxed font-light max-w-sm">
                Discover the best trending gadgets and high-quality products curated specifically for the Amazon US market. Experience modern living with handpicked essentials.
              </p>
              <div className="flex gap-4">
                {["Twitter", "Instagram", "Facebook"].map(social => (
                  <button key={social} className="px-6 py-2 rounded-full border border-white/10 text-xs font-bold text-slate-400 hover:text-white hover:border-indigo-500 transition-all uppercase tracking-widest">
                    {social}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="space-y-6">
              <h5 className="text-[10px] text-white uppercase tracking-[0.4em] font-black">Discover</h5>
              <ul className="space-y-4">
                {CATEGORIES.map(cat => (
                  <li key={cat.id}>
                    <button onClick={() => handleSearch(cat.prompt)} className="text-slate-400 hover:text-indigo-400 transition-colors text-sm font-light leading-relaxed">
                      {cat.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-6">
              <h5 className="text-[10px] text-white uppercase tracking-[0.4em] font-black">Legal</h5>
              <ul className="space-y-4 text-sm font-light text-slate-400">
                <li><a href="#" className="hover:text-indigo-400 transition-colors">Affiliate Disclosure</a></li>
                <li><a href="#" className="hover:text-indigo-400 transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-indigo-400 transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-indigo-400 transition-colors">Contact Us</a></li>
              </ul>
            </div>
          </div>
          
          <div className="pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed text-center md:text-left">
              &copy; {new Date().getFullYear()} Smart Gadget Store. Curated for smart living. <br />
              <span className="opacity-50">Amazon and the Amazon logo are trademarks of Amazon.com, Inc. or its affiliates.</span>
            </p>
            <div className="flex items-center gap-2 text-slate-500 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
              <span>Curated for</span>
              <div className="w-1 h-1 rounded-full bg-blue-500" />
              <span>United States</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
