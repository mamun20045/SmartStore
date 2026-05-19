import React, { useState, useRef, useEffect } from "react";
import AdsterraBanner from "./components/AdsterraBanner";
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
  Lock,
  TrendingUp,
  MousePointer2,
  Calendar,
  Star,
  ShoppingBag,
  Plus,
  RefreshCw,
  Trash2,
  Eye, 
  Globe,
  CheckCircle2,
  ChevronDown,
  ArrowUpRight,
  Heart,
  Share2,
  ShieldCheck,
  ShieldAlert,
  Truck,
  RotateCcw,
  MapPin,
  PlayCircle,
  Play,
  ImagePlus,
  ThumbsUp,
  Info,
  Facebook,
  Twitter,
  MessageCircle,
  Link as LinkIcon
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

const DEMO_TRAFFIC_DATA: any[] = [];
import { motion, AnimatePresence } from "motion/react";
import { getMarketingStrategy } from "./services/gemini";
import { Product, Settings } from "./types";
import { db, auth } from "./lib/firebase";
import { doc, getDoc, setDoc, updateDoc, collection, addDoc, getDocs, query, orderBy, limit, deleteDoc, writeBatch, onSnapshot, increment } from "firebase/firestore";
import { signOut, onAuthStateChanged, User, signInWithEmailAndPassword, createUserWithEmailAndPassword, updatePassword, GoogleAuthProvider, signInWithPopup } from "firebase/auth";

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
  const errMessage = error instanceof Error ? error.message : String(error);
  
  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  
  if (errMessage.toLowerCase().includes("permission-denied") || errMessage.toLowerCase().includes("insufficient permissions")) {
    alert("ভুল (Permission Error): Please check if you are logged in properly. Database is being updated.");
  } else {
    alert("Database Notice: " + errMessage);
  }
  
  throw new Error(JSON.stringify(errInfo));
}

const CATEGORIES = [
  { id: "lighting", name: "Smart Lighting", icon: Zap, color: "text-yellow-400" },
  { id: "vacuums", name: "Robot Vacuums", icon: Package, color: "text-blue-400" },
  { id: "kitchen", name: "Smart Kitchen", icon: Home, color: "text-emerald-400" },
  { id: "audio", name: "Portable Audio", icon: Smartphone, color: "text-purple-400" },
  { id: "mobile", name: "Mobile Accessories", icon: Smartphone, color: "text-indigo-400" },
  { id: "pets", name: "Smart Pet Tech", icon: PawPrint, color: "text-rose-400" },
];

const DEFAULT_SETTINGS: Settings = {
  affiliateTag: "smartgadget-20",
  storeName: "USA Smart Gadget",
  logoURL: "",
  adsterraKey: "bec4d3245746ed2be5b9f8aa8cd14ce2",
  adsterraCode: "",
  adsterraKey2: "",
  adsterraCode2: ""
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

// Helper function to compress images before saving to Firestore to stay under 1MB limit
const compressImage = (base64Str: string, maxWidth = 800, maxHeight = 800, quality = 0.6): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
  });
};

export default function App() {
  const [queryInput, setQueryInput] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [user, setUser] = useState<User | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [stats, setStats] = useState({ totalClicks: 0, recentClicks: [] as any[] });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [view, setView] = useState<'home' | 'product' | 'admin'>('home');
  const [adminSubView, setAdminSubView] = useState<'overview' | 'products' | 'settings' | 'profile'>('overview');
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [visitorStats, setVisitorStats] = useState<any[]>([]);
  const [totalVisitorCount, setTotalVisitorCount] = useState(0);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);

  // Real-time Visitor Tracking
  useEffect(() => {
    const trackVisitor = async () => {
      // Use v4 to force retry for users who were blocked or had failures before
      const sessionTracked = sessionStorage.getItem('tracked_visit_v4');
      if (sessionTracked) return;

      const endpoints = [
        'https://ipwhois.app/json/',
        'https://ip-api.com/json',
        'https://freeipapi.com/api/json',
        'https://ipapi.co/json/'
      ];

      let countryData = null;

      for (const url of endpoints) {
        try {
          const res = await fetch(url);
          if (!res.ok) continue;
          const data = await res.json();
          
          const code = (data.country_code || data.countryCode || data.country_code2 || '').toUpperCase();
          const name = data.country_name || data.country || data.countryName || 'Unknown';
          
          if (code && code.length === 2) {
            countryData = { code, name };
            break;
          }
        } catch (e) {
          // Silent fail to next endpoint
        }
      }
      
      if (countryData && countryData.code) {
        try {
          const countryRef = doc(db, "analytics_geo", countryData.code);
          const flags: Record<string, string> = { 
            'US': '🇺🇸', 'BD': '🇧🇩', 'GB': '🇬🇧', 'UK': '🇬🇧', 'IN': '🇮🇳', 'DE': '🇩🇪', 
            'FR': '🇫🇷', 'CA': '🇨🇦', 'AU': '🇦🇺', 'CN': '🇨🇳', 'JP': '🇯🇵', 
            'SA': '🇸🇦', 'AE': '🇦🇪', 'PK': '🇵🇰', 'MY': '🇲🇾', 'SG': '🇸🇬',
            'IT': '🇮🇹', 'ES': '🇪🇸', 'BR': '🇧🇷', 'RU': '🇷🇺', 'MX': '🇲🇽'
          };
          
          await setDoc(countryRef, {
            count: increment(1),
            countryCode: countryData.code,
            countryName: countryData.name,
            flag: flags[countryData.code] || '🌍',
            lastUpdated: new Date().toISOString()
          }, { merge: true });

          sessionStorage.setItem('tracked_visit_v4', 'true');
        } catch (e) {
          console.error("Firestore visitor track failed:", e);
        }
      }
    };
    
    const timer = setTimeout(trackVisitor, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Subscribe to Real-time Analytics
  useEffect(() => {
    if (!isAdmin(user)) return;

    // Subscribe to Visitor Stats
    const unsubGeo = onSnapshot(collection(db, "analytics_geo"), (snapshot) => {
      const stats = snapshot.docs.map(doc => doc.data());
      stats.sort((a, b) => b.count - a.count);
      setVisitorStats(stats);
      setTotalVisitorCount(stats.reduce((acc, curr) => acc + (curr.count || 0), 0));
    });

    // Subscribe to Clicks & Calculate Top Performers
    const unsubClicks = onSnapshot(collection(db, "clicks"), (snapshot) => {
      const clickDocs = snapshot.docs.map(doc => doc.data());
      
      const clickCounts: Record<string, number> = {};
      clickDocs.forEach(c => {
        if (c.id) clickCounts[c.id] = (clickCounts[c.id] || 0) + 1;
      });
      
      const sortedTop = Object.entries(clickCounts)
        .map(([id, count]) => {
          const product = allProducts.find(p => p.id === id);
          return { id, count, name: product?.name || 'Unknown Product' };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      setTopProducts(sortedTop);
      setStats({
        totalClicks: snapshot.size,
        recentClicks: snapshot.docs.slice(-5).map(doc => doc.data()).reverse()
      });
    });

    return () => {
      unsubGeo();
      unsubClicks();
    };
  }, [user, allProducts]);

  const [adminEmailInput, setAdminEmailInput] = useState("");
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [marketingStrategy, setMarketingStrategy] = useState<string | null>(null);
  const [isGeneratingStrategy, setIsGeneratingStrategy] = useState(false);
  const [mainImage, setMainImage] = useState<string | null>(null);

  const isAdmin = (user: User | null) => 
    user?.email?.toLowerCase() === 'chinaonlinebdpurchase2@gmail.com';

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    if (newPasswordInput.length < 6) {
      alert("পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে।\n\nPassword must be at least 6 characters.");
      return;
    }
    
    setIsUpdatingPassword(true);
    try {
      await updatePassword(auth.currentUser, newPasswordInput);
      alert("পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে।\n\nPassword updated successfully!");
      setNewPasswordInput("");
    } catch (error: any) {
      console.error("Password Update Error:", error);
      if (error.code === 'auth/requires-recent-login') {
        alert("নিরাপত্তার কারণে আপনাকে আবার লগইন করতে হবে। এর পর আবার চেষ্টা করুন।\n\nPlease re-login and try again for security reasons.");
        logout();
      } else {
        alert("ভুল হয়েছে: " + error.message);
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    const targetAdminEmail = 'chinaonlinebdpurchase2@gmail.com';
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      if (user.email?.toLowerCase() !== targetAdminEmail) {
        await signOut(auth);
        alert("অ্যাক্সেস ডিনাইড! এই ইমেইলটি অ্যাডমিন হিসেবে অনুমোদিত নয়।\n\nAccess Denied! This email is not authorized as an administrator.");
        return;
      }
      
      setAdminSubView('overview');
    } catch (error: any) {
      console.error("Google Login Error:", error);
      if (error.code === 'auth/popup-blocked') {
        alert("পপ-আপ ব্লক করা হয়েছে। দয়া করে পপ-আপ এলাউ করুন।\n\nPopup was blocked. Please allow popups for this site.");
      } else {
        alert("Google Login Error: " + error.message);
      }
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const email = adminEmailInput.trim().toLowerCase();
    const password = adminPasswordInput.trim();
    const targetAdminEmail = 'chinaonlinebdpurchase2@gmail.com';

    if (email !== targetAdminEmail) {
      alert("অ্যাডমিন ইমেইল ভুল হয়েছে। শুধুমাত্র অনুমোদিত ইমেইল ব্যবহার করুন।\n\nIncorrect Email. Use unauthorized admin email only.");
      return;
    }
    
    if (!password) {
      alert("পাসওয়ার্ড দিন।\n\nPlease enter your password.");
      return;
    }
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setAdminSubView('overview');
    } catch (error: any) {
      console.error("Login Error:", error.code, error.message);
      
      if (error.code === 'auth/too-many-requests') {
        alert("নিরাপত্তার কারণে আপনার অ্যাকাউন্ট সাময়িকভাবে ব্লক করা হয়েছে। দয়া করে ৫-১০ মিনিট অপেক্ষা করে আবার চেষ্টা করুন।\n\nSecurity notice: Too many failed attempts. Please wait 5-10 minutes.");
      } else if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        // First-time registration logic for the specific admin email
        const wantRegister = confirm("এই অ্যাপের জন্য আপনার পাসওয়ার্ড সেট করা নেই। আপনি কি '" + targetAdminEmail + "' এর জন্য এই পাসওয়ার্ডটি রেজিস্টার করতে চান?\n\nIf you haven't set a password yet, click OK to REGISTER this account.");
        if (wantRegister) {
          try {
            if (password.length < 6) {
              alert("পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে।\n\nPassword must be at least 6 characters.");
              return;
            }
            await createUserWithEmailAndPassword(auth, email, password);
            alert("অ্যাডমিন অ্যাকাউন্ট তৈরি হয়েছে! আপনি এখন লগইন অবস্থায় আছেন।\n\nAdmin account created successfully!");
            setAdminSubView('overview');
          } catch (regError: any) {
            alert("Registration Error: " + regError.message);
          }
        } else {
          alert("ভুল পাসওয়ার্ড। দয়া করে আবার চেষ্টা করুন।\n\nWrong password. Please try again.");
        }
      } else {
        alert("Login Error: " + error.message);
      }
      setAdminPasswordInput("");
    }
  };

  const handleResetPassword = async () => {
    const email = adminEmailInput.trim();
    if (!email || email.toLowerCase() !== 'chinaonlinebdpurchase2@gmail.com') {
      alert("পাসওয়ার্ড রিসেট করতে আপনার সঠিক অ্যাডমিন ইমেইল দিন।\n\nEnter your admin email first.");
      return;
    }
    try {
      const { sendPasswordResetEmail } = await import("firebase/auth");
      await sendPasswordResetEmail(auth, email);
      alert("আপনার ইমেইলে password reset লিংক পাঠানো হয়েছে। চেক করুন।\n\nPassword reset email sent. Please check your inbox.");
    } catch (error: any) {
      alert("Error: " + error.message);
    }
  };

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
    images: [],
    rating: "",
    review_count: "1",
    trust_badge: "Curated"
  });
  const productsSectionRef = useRef<HTMLDivElement>(null);
  const categoriesSectionRef = useRef<HTMLDivElement>(null);
  const dealsSectionRef = useRef<HTMLDivElement>(null);
  const newTechSectionRef = useRef<HTMLDivElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        // Compress image before adding to state
        const compressedBase64 = await compressImage(base64);
        
        setManualProduct(prev => {
          const currentImages = prev.images || [];
          if (currentImages.length >= 10) return prev;
          const newImages = [...currentImages, compressedBase64];
          return {
            ...prev,
            images: newImages,
            // If main image_url is empty, set it to the first uploaded image
            image_url: prev.image_url || newImages[0]
          };
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const handleEditProduct = (product: Product) => {
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
      rating: "5.0",
      review_count: "1",
      trust_badge: "Curated",
      ...product 
    });
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
      setAllProducts(prev => {
        const index = prev.findIndex(p => p.id === fullProduct.id);
        if (index !== -1) {
          const updated = [...prev];
          updated[index] = fullProduct;
          return updated;
        }
        return [fullProduct, ...prev];
      });
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
  const handleCategoryFilter = (categoryName: string) => {
    if (view !== 'home') {
      setView('home');
      setSelectedProduct(null);
    }
    setIsSearching(true);
    const filtered = allProducts.filter(p => 
      p.category?.toLowerCase().includes(categoryName.toLowerCase()) ||
      p.name.toLowerCase().includes(categoryName.toLowerCase())
    );
    setTimeout(() => {
      setProducts(filtered);
      setIsSearching(false);
      
      // Delay scroll to allow home view to render
      setTimeout(() => {
        if (productsSectionRef.current) {
          window.scrollTo({
            top: productsSectionRef.current.offsetTop - 100,
            behavior: "smooth"
          });
        }
      }, 100);
    }, 300);
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
    // Redundant as we use onSnapshot now
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

  const navigateToHomeSection = (ref: React.RefObject<HTMLDivElement>) => {
    if (view !== 'home') {
      setView('home');
      setSelectedProduct(null);
      // Wait for rendering then scroll
      setTimeout(() => {
        if (ref.current) {
          window.scrollTo({
            top: ref.current.offsetTop - 100,
            behavior: "smooth"
          });
        }
      }, 100);
    } else {
      if (ref.current) {
        window.scrollTo({
          top: ref.current.offsetTop - 100,
          behavior: "smooth"
        });
      }
    }
  };

  const deleteAllProducts = async () => {
    setIsDeletingAll(true);
    setConfirmDeleteAll(false);
    try {
      console.log("Fetching all products for deletion...");
      const querySnapshot = await getDocs(collection(db, "products"));
      if (querySnapshot.empty) {
        setIsDeletingAll(false);
        alert("মোছার জন্য কোনো পণ্য খুঁজে পাওয়া যায়নি।\n\nNo products found to delete.");
        return;
      }
      
      console.log(`Found ${querySnapshot.size} products. Attempting deletion...`);
      
      // Attempt batch delete first
      try {
        const batch = writeBatch(db);
        querySnapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
      } catch (batchError) {
         console.warn("Batch delete failed, falling back to individual deletes:", batchError);
         // Fallback to individual deletes if batch fails (unlikely but safer)
         const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
         await Promise.all(deletePromises);
      }
      
      console.log("Delete successful.");
      
      setAllProducts([]);
      setProducts([]);
      alert(`সফলভাবে ${querySnapshot.size} টি পণ্য মুছে ফেলা হয়েছে।\n\nSuccess: ${querySnapshot.size} products have been deleted.`);
    } catch (error: any) {
      console.error("Delete All Error:", error);
      alert("সবগুলো মুছতে সমস্যা হয়েছে: " + error.message);
      handleFirestoreError(error, OperationType.DELETE, "products");
    } finally {
      setIsDeletingAll(false);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setAdminEmailInput("");
      setAdminPasswordInput("");
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
          setSettings({ ...DEFAULT_SETTINGS, ...settingsDoc.data() } as Settings);
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
    console.log("deleteProduct called with id:", id);
    if (!id) {
      alert("Error: Product ID is missing.");
      return;
    }
    
    setDeletingProductId(id);
    setConfirmDeleteId(null);
    const path = `products/${id}`;
    try {
      console.log("Attempting to delete document:", path);
      const docRef = doc(db, "products", id);
      await deleteDoc(docRef);
      
      // Update UI after successful delete
      setAllProducts(prev => prev.filter(p => p.id !== id));
      setProducts(prev => {
        if (!prev) return null;
        return prev.filter(p => p.id !== id);
      });
      
      console.log("Product successfully deleted from Firestore:", id);
      alert("সফলভাবে মুছে ফেলা হয়েছে।\n\nProduct deleted successfully.");
    } catch (error: any) {
      console.error("Delete Error details:", error);
      alert("মুছে ফেলতে সমস্যা হয়েছে: " + error.message + "\n\nError: " + error.message);
      handleFirestoreError(error, OperationType.DELETE, path);
    } finally {
      setDeletingProductId(null);
    }
  };

  const handleSearch = (inputQuery: string) => {
    if (!inputQuery.trim()) {
      setProducts(allProducts);
      return;
    }
    
    setIsSearching(true);
    
    // Local filter search
    const lowerQuery = inputQuery.toLowerCase();
    const filtered = allProducts.filter(p => 
      p.name.toLowerCase().includes(lowerQuery) || 
      p.description?.toLowerCase().includes(lowerQuery) ||
      p.category?.toLowerCase().includes(lowerQuery) ||
      p.brand?.toLowerCase().includes(lowerQuery)
    );

    setTimeout(() => {
      setProducts(filtered);
      setIsSearching(false);
      if (productsSectionRef.current) {
        window.scrollTo({
          top: productsSectionRef.current.offsetTop - 100,
          behavior: "smooth"
        });
      }
    }, 300);
  };

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "products"));
        const loadedProducts = querySnapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id
        })) as Product[];
        
        // Sort in memory to ensure manual items missing createdAt field are still visible
        loadedProducts.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
        
        setAllProducts(loadedProducts);
        setProducts(loadedProducts);
        setIsInitialLoading(false);
        console.log("Products loaded from Firestore:", loadedProducts.length);

        // Deep linking support
        const urlParams = new URLSearchParams(window.location.search);
        const productId = urlParams.get('product');
        if (productId) {
          const found = loadedProducts.find(p => p.id === productId || p.asin === productId);
          if (found) {
            setSelectedProduct(found);
            setView('product');
          }
        }
      } catch (error) {
        console.error("Error loading products:", error);
        setIsInitialLoading(false);
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
          <div className="flex items-center gap-2 group cursor-pointer" onClick={() => { setView('home'); setSelectedProduct(null); setProducts(allProducts); setQueryInput(""); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
            {settings.logoURL ? (
              <img src={settings.logoURL} alt={settings.storeName} className="h-8 md:h-12 object-contain" />
            ) : (
              <img src="/logo.png" alt="USA Smart Gadget" className="h-8 md:h-12 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} />
            )}
            <span className="text-sm md:text-xl font-display font-black text-white tracking-tight uppercase">
              {settings.storeName?.split(' ').slice(0, -1).join(' ') || 'Smart'}
              <span className="text-blue-500 ml-1">{settings.storeName?.split(' ').slice(-1) || 'Gadget'}</span>
            </span>
          </div>

          <div className="hidden lg:flex items-center gap-6">
            <button 
              onClick={() => { setView('home'); setSelectedProduct(null); setProducts(allProducts); setQueryInput(""); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              className={`text-xs font-bold transition-all tracking-widest uppercase ${view === 'home' ? "text-blue-400 border-b-2 border-blue-400 pb-0.5" : "text-slate-400 hover:text-white"}`}
            >
              Home
            </button>
            <div className="group relative">
              <button 
                onClick={() => navigateToHomeSection(categoriesSectionRef)}
                className="text-xs font-bold text-slate-400 hover:text-white transition-colors tracking-widest uppercase flex items-center gap-1"
              >
                Shop <ChevronRight size={14} className="rotate-90" />
              </button>
            </div>
            <button 
              onClick={() => navigateToHomeSection(dealsSectionRef)}
              className="text-xs font-bold text-slate-400 hover:text-white transition-colors tracking-widest uppercase"
            >
              Deals
            </button>
          </div>

          <div className="flex-1 max-w-md mx-8 hidden sm:block">
            <div className="relative group">
              <input 
                type="text" 
                placeholder="Search products..."
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-10 text-[11px] text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-slate-600"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch(queryInput)}
              />
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
              <button 
                onClick={() => handleSearch(queryInput)}
                className="absolute right-1 top-1/2 -translate-y-1/2 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded-lg transition-all text-[9px] font-black uppercase tracking-widest"
              >
                Search
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => setView('admin')} 
              className={`p-2 transition-all rounded-full ${view === 'admin' ? "bg-blue-600/20 text-blue-400" : "text-slate-400 hover:bg-white/5"}`}
              title="Admin Portal"
            >
              <SettingsIcon size={20} />
            </button>
            
            {user && (
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
                <div className="mb-4">
                   <div className="relative group">
                      <input 
                        type="text" 
                        placeholder="Search products..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-10 text-xs text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-slate-600"
                        value={queryInput}
                        onChange={(e) => setQueryInput(e.target.value)}
                        onKeyDown={(e) => { if(e.key === "Enter") { handleSearch(queryInput); setMobileMenuOpen(false); } }}
                      />
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                   </div>
                </div>
                {[
                  { label: "Home", action: () => { setView('home'); setSelectedProduct(null); setProducts(allProducts); setQueryInput(""); window.scrollTo({ top: 0, behavior: "smooth" }); } },
                  { label: "Category", action: () => navigateToHomeSection(categoriesSectionRef) },
                  { label: "Deals", action: () => navigateToHomeSection(dealsSectionRef) },
                  { label: "New Tech", action: () => navigateToHomeSection(newTechSectionRef) },
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
        <main className="relative z-10 pt-20 px-6 pb-24 max-w-7xl mx-auto">
        {/* Categories Section */}
        <section ref={categoriesSectionRef} className="mb-8 scroll-mt-24">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-black uppercase tracking-tight text-white mb-4">BROWSE SMART CATEGORIES</h2>
            <p className="text-slate-400 text-sm font-light">Find the Perfect Tech for Every Corner of Your Life.</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-6">
            {CATEGORIES.map((cat, idx) => (
              <motion.div
                key={cat.id}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => handleCategoryFilter(cat.name)}
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

        {/* Adsterra Advertisement Banners - Dual Slot on Desktop */}
        <div className="w-full mt-8 mb-8 flex justify-center px-4">
          <div className="w-full max-w-[1550px] flex flex-col lg:flex-row gap-6 justify-center items-center">
            {/* Slot 1 */}
            <div className="w-full lg:w-1/2 bg-[#0a1120] border border-slate-800/30 rounded-xl flex flex-col items-center justify-center relative overflow-hidden group min-h-[90px] shadow-lg transition-all">
               <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-transparent to-emerald-500/5 opacity-20" />
               <div className="relative z-10 w-full flex justify-center items-center">
                  <div className="flex flex-col items-center">
                     <span className="text-[6px] text-slate-700 uppercase font-black tracking-[0.2em] mb-0.5">Advertisement Slot 1</span>
                     <div className="w-full overflow-hidden flex items-center justify-center border border-dashed border-slate-800/10 px-4 py-1 rounded-lg bg-slate-900/10 min-h-[50px] md:min-h-[90px]">
                        {/* Desktop Banner */}
                        <div className="hidden md:block">
                           <AdsterraBanner 
                              id="adsterra-banner-desktop-1" 
                              height={90} 
                              width={728} 
                              atKey={settings.adsterraKey || DEFAULT_SETTINGS.adsterraKey || ''} 
                              adCode={settings.adsterraCode}
                           />
                        </div>
                        {/* Mobile Banner */}
                        <div className="block md:hidden">
                           <AdsterraBanner 
                              id="adsterra-banner-mobile-1" 
                              height={50} 
                              width={320} 
                              atKey={settings.adsterraKey || DEFAULT_SETTINGS.adsterraKey || ''} 
                              adCode={settings.adsterraCode}
                           />
                        </div>
                        {!(settings.adsterraKey || DEFAULT_SETTINGS.adsterraKey || settings.adsterraCode) && (
                           <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <span className="text-white font-mono text-[8px] tracking-[0.6em] uppercase opacity-40">
                                 Insert Adsterra Key or Script 1
                              </span>
                           </div>
                        )}
                     </div>
                  </div>
               </div>
               <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            </div>

            {/* Slot 2 */}
            <div className="w-full lg:w-1/2 bg-[#0a1120] border border-slate-800/30 rounded-xl flex flex-col items-center justify-center relative overflow-hidden group min-h-[90px] shadow-lg transition-all">
               <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-blue-500/5 opacity-20" />
               <div className="relative z-10 w-full flex justify-center items-center">
                  <div className="flex flex-col items-center">
                     <span className="text-[6px] text-slate-700 uppercase font-black tracking-[0.2em] mb-0.5">Advertisement Slot 2</span>
                     <div className="w-full overflow-hidden flex items-center justify-center border border-dashed border-slate-800/10 px-4 py-1 rounded-lg bg-slate-900/10 min-h-[50px] md:min-h-[90px]">
                        {/* Desktop Banner */}
                        <div className="hidden md:block">
                           <AdsterraBanner 
                              id="adsterra-banner-desktop-2" 
                              height={90} 
                              width={728} 
                              atKey={settings.adsterraKey2 || DEFAULT_SETTINGS.adsterraKey2 || ''} 
                              adCode={settings.adsterraCode2}
                           />
                        </div>
                        {/* Mobile Banner */}
                        <div className="block md:hidden">
                           <AdsterraBanner 
                              id="adsterra-banner-mobile-2" 
                              height={50} 
                              width={320} 
                              atKey={settings.adsterraKey2 || DEFAULT_SETTINGS.adsterraKey2 || ''} 
                              adCode={settings.adsterraCode2}
                           />
                        </div>
                        {!(settings.adsterraKey2 || DEFAULT_SETTINGS.adsterraKey2 || settings.adsterraCode2) && (
                           <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <span className="text-white font-mono text-[8px] tracking-[0.6em] uppercase opacity-40">
                                 Insert Adsterra Key or Script 2
                              </span>
                           </div>
                        )}
                     </div>
                  </div>
               </div>
               <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Product Grid */}
        <section ref={productsSectionRef} className="mt-8 mb-24 scroll-mt-24">
          <div className="mb-8">
            <h2 className="text-2xl font-black uppercase tracking-tight text-white font-sans">Featured Products</h2>
          </div>

          {isSearching ? (
             <div className="flex flex-col items-center justify-center py-24 gap-4 animate-pulse">
                <Loader2 className="animate-spin text-blue-500" size={40} />
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Searching products...</p>
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
                  <div className="aspect-[16/9] bg-white relative overflow-hidden flex items-center justify-center">
                    {product.image_url ? (
                      <img 
                        src={product.image_url} 
                        alt={product.name}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = "https://placehold.co/600x400/0a1120/white?text=No+Image";
                        }}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      />
                    ) : (
                       <div className="w-full h-full bg-slate-100 animate-pulse" />
                    )}
                  </div>
                  
                  <div className="p-4 flex flex-col flex-1 items-start text-left">
                    <h3 className="text-[11px] font-black text-white mb-0.5 uppercase tracking-tight truncate w-full">
                      {product.name || "Loading product info..."}
                    </h3>
                    <p className="text-slate-500 text-[9px] mb-3 line-clamp-1 italic font-light">
                      {product.description || "Top rated electronic gadget available on Amazon US."}
                    </p>
                    
                    <div className="flex items-center justify-between w-full mb-3">
                      <div className="star-rating">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} size={9} className={s <= Math.round(parseFloat(product.rating || "4.5")) ? "text-yellow-500 fill-yellow-500" : "text-slate-700"} />
                        ))}
                        <span className="text-[9px] text-slate-500 ml-1">({product.review_count || "234"})</span>
                      </div>
                      <span className="text-sm font-black text-white">{parsePrice(product.price).full}</span>
                    </div>

                    <a 
                      href={product.affiliate_link || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        e.stopPropagation();
                        product.id && logClick(product.id);
                      }}
                      className="amazon-btn py-2 text-[9px]"
                    >
                      Check Price <ShoppingBag size={12} />
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
                  {product.image_url && <img src={product.image_url} referrerPolicy="no-referrer" onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/600x400/0a1120/white?text=No+Image"; }} className="w-full h-full object-contain" />}
                </div>
                <div className="p-4 space-y-3 flex flex-col items-start text-left">
                   <div>
                    <h3 className="text-[11px] font-black text-white uppercase truncate w-full">{product.name || "Special Deal Title"}</h3>
                    <p className="text-rose-400 text-[9px] font-bold uppercase tracking-widest mt-0.5">Limited Offer</p>
                   </div>
                   <div className="flex justify-between items-center w-full">
                      <div className="star-rating">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} size={9} fill="currentColor" />
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
                     className="deals-btn uppercase py-2 text-[9px]"
                   >
                     View Deal
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
                  {product.image_url && <img src={product.image_url} referrerPolicy="no-referrer" onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/600x400/0a1120/white?text=No+Image"; }} className="w-full h-full object-contain" />}
                </div>
                <div className="p-4 flex flex-col gap-3 items-start text-left">
                  <h3 className="text-[11px] font-black text-white truncate w-full">{product.name || "Latest Accessory"}</h3>
                  <div className="flex justify-between items-center w-full">
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
                    Check Price
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
      ) : view === 'admin' ? ( /* ADMIN OK */
        !isAdmin(user) ? (
          /* Admin Login Prompt */
          <main className="pt-36 bg-[#050b18] min-h-screen flex items-center justify-center px-4 relative z-20">
             <div className="max-w-md w-full bg-[#0a1120] border border-blue-500/20 rounded-[32px] p-10 shadow-2xl animate-in fade-in zoom-in duration-500">
                <div className="text-center mb-10">
                   {settings.logoURL ? (
                      <img src={settings.logoURL} alt={settings.storeName} className="h-16 mx-auto mb-6 object-contain" />
                   ) : (
                      <img src="/logo.png" alt="USA Smart Gadget" className="h-16 mx-auto mb-6 object-contain" />
                   )}
                   <h2 className="text-3xl font-black text-white uppercase tracking-tight mb-2">Admin Portal</h2>
                   <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-4">Authorized Access Only</p>
                </div>
                
                <form onSubmit={handleAdminLogin} className="space-y-6">


                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Admin Email</label>
                      <input 
                         type="email" 
                         value={adminEmailInput}
                         onChange={(e) => setAdminEmailInput(e.target.value)}
                         className="w-full bg-slate-950 border border-white/10 rounded-2xl px-6 py-4 text-white text-sm outline-none focus:border-blue-500 transition-all font-bold"
                         placeholder="Email Address"
                         autoFocus
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Password</label>
                      <input 
                         type="password" 
                         value={adminPasswordInput}
                         onChange={(e) => setAdminPasswordInput(e.target.value)}
                         className="w-full bg-slate-950 border border-white/10 rounded-2xl px-6 py-4 text-white text-sm outline-none focus:border-blue-500 transition-all"
                         placeholder="••••••••"
                      />
                   </div>
                   <button 
                      type="submit"
                      className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-600/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                   >
                      <LogIn size={18} /> Authenticate
                   </button>
                </form>
                <div className="relative my-8">
                   <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/5"></div>
                   </div>
                   <div className="relative flex justify-center text-[10px] uppercase font-black tracking-widest text-slate-600">
                      <span className="bg-[#0a1120] px-4">Authorized Access Only</span>
                   </div>
                </div>

                <div className="space-y-4">
                  <button 
                    onClick={handleGoogleLogin}
                    className="w-full py-5 bg-white hover:bg-slate-100 text-slate-950 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all active:scale-95 flex items-center justify-center gap-3"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                    Google Login
                  </button>
                </div>
                <div className="mt-10">
                   <button 
                      type="button"
                      onClick={handleResetPassword}
                      className="w-full text-[10px] font-black text-blue-500 hover:text-blue-400 uppercase tracking-widest transition-colors mb-4"
                   >
                      Forgot Password?
                   </button>
                   <button 
                      type="button"
                      onClick={() => setView('home')}
                      className="w-full text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors"
                   >
                      Back to Storefront
                   </button>
                </div>
             </div>
          </main>
        ) : (
        /* Professional Admin Dashboard */
        <main className="pt-20 bg-[#050b18] min-h-screen flex flex-col md:flex-row relative z-20">
            {/* Sidebar Navigation */}
            <aside className="w-full md:w-64 bg-[#0a1120] border-r border-white/5 p-6 flex flex-col gap-2 shrink-0">
               <div className="mb-8 px-2">
                  <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-6">Management</h2>
                  <div className="space-y-1">
                     {[
                        { id: 'overview', label: 'Dashboard', icon: LucideBarChart },
                        { id: 'products', label: 'Products', icon: Package },
                        { id: 'settings', label: 'Settings', icon: SettingsIcon },
                        { id: 'profile', label: 'Profile', icon: UserIcon },
                     ].map((item: any) => (
                        <button
                           key={item.id}
                           onClick={() => setAdminSubView(item.id)}
                           className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                              adminSubView === item.id 
                              ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" 
                              : "text-slate-400 hover:bg-white/5 hover:text-white"
                           }`}
                        >
                           <item.icon size={18} />
                           {item.label}
                        </button>
                     ))}
                  </div>
               </div>

               <div className="mt-auto pt-6 border-t border-white/5 px-2">
                  <button 
                     onClick={logout}
                     className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-rose-500 hover:bg-rose-500/10 transition-all"
                  >
                     <LogOut size={18} />
                     Sign Out
                  </button>
               </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 p-6 md:p-10 overflow-y-auto">
               <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                     <h1 className="text-3xl font-black text-white uppercase tracking-tight">
                        {adminSubView === 'overview' ? 'Command Center' : adminSubView === 'products' ? 'Catalog Manager' : adminSubView === 'profile' ? 'Admin Profile' : 'Store Settings'}
                     </h1>
                     <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-slate-500 uppercase font-black tracking-widest">
                           {adminSubView === 'profile' ? 'Manage your credentials' : `Welcome back, ${user?.displayName || 'Administrator'}`}
                        </p>
                     </div>
                  </div>
                  <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl px-4 py-2">
                     <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                     <span className="text-[10px] font-black text-white uppercase tracking-widest">System Operational</span>
                  </div>
               </header>

               {adminSubView === 'overview' && (
                  <div className="space-y-10 animate-in fade-in duration-500">
                     {/* Stats Grid */}
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                           { label: 'Total Clicks', value: stats.totalClicks.toLocaleString(), trend: 'LIVE', icon: MousePointer2, color: 'text-blue-400', bg: 'bg-blue-400/10' },
                           { label: 'Inventory', value: allProducts.length, trend: 'Catalog', icon: Package, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
                           { label: 'Conversion', value: totalVisitorCount > 0 ? `${((stats.totalClicks / totalVisitorCount) * 100).toFixed(1)}%` : '0%', trend: 'Realtime', icon: TrendingUp, color: 'text-purple-400', bg: 'bg-purple-400/10' },
                           { label: 'Visitors', value: totalVisitorCount.toLocaleString(), trend: 'LIVE', icon: Globe, color: 'text-orange-400', bg: 'bg-orange-400/10' },
                        ].map((stat, i) => (
                           <div key={i} className="bg-[#0a1120] border border-white/5 p-6 rounded-3xl shadow-xl">
                              <div className="flex justify-between items-start mb-4">
                                 <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color}`}>
                                    <stat.icon size={20} />
                                 </div>
                                 <span className="text-[10px] font-black text-emerald-400 bg-emerald-400/5 px-2 py-1 rounded-lg">{stat.trend}</span>
                              </div>
                              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{stat.label}</p>
                              <p className="text-2xl font-black text-white">{stat.value}</p>
                           </div>
                        ))}
                     </div>

                     <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                        {/* Traffic Chart */}
                        <div className="bg-[#0a1120] border border-white/5 p-8 rounded-[32px] shadow-2xl">
                           <h3 className="text-lg font-black text-white uppercase tracking-tight mb-8">Traffic Velocity</h3>
                           <div className="h-64 w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                 <AreaChart data={DEMO_TRAFFIC_DATA}>
                                    <defs>
                                       <linearGradient id="adminClicks" x1="0" y1="0" x2="0" y2="1">
                                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                       </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                    <XAxis dataKey="name" stroke="#475569" fontSize={10} axisLine={false} tickLine={false} />
                                    <YAxis stroke="#475569" fontSize={10} axisLine={false} tickLine={false} />
                                    <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #ffffff10", borderRadius: "12px" }} />
                                    <Area type="monotone" dataKey="clicks" stroke="#3b82f6" fillOpacity={1} fill="url(#adminClicks)" strokeWidth={3} />
                                 </AreaChart>
                              </ResponsiveContainer>
                           </div>
                        </div>                      {/* Geo Distribution */}
                      <div className="bg-[#0a1120] border border-white/5 p-8 rounded-[32px] shadow-2xl overflow-hidden relative">
                         <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full -mr-32 -mt-32 blur-3xl" />
                         
                         <div className="flex justify-between items-center mb-10 relative z-10">
                            <div>
                               <h3 className="text-xl font-black text-white uppercase tracking-tight">Geo-Distribution</h3>
                               <p className="text-xs text-slate-500 font-bold mt-1 uppercase tracking-widest">Global Audience reach</p>
                            </div>
                            <div className="flex items-center gap-3">
                               <button 
                                 onClick={async () => {
                                   try {
                                     const countryRef = doc(db, "analytics_geo", "TEST");
                                     await setDoc(countryRef, {
                                       count: increment(1),
                                       countryCode: "TEST",
                                       countryName: "Test Environment",
                                       flag: "🧪",
                                       lastUpdated: new Date().toISOString()
                                     }, { merge: true });
                                     alert("Test track success! If you still see 0 visitors, check your internet or Firebase connection.");
                                   } catch (e) {
                                     alert("Test track failed: " + (e instanceof Error ? e.message : String(e)));
                                   }
                                 }}
                                 className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[10px] font-black text-blue-400 uppercase tracking-widest transition-all"
                               >
                                 Test Track
                               </button>
                               <div className="flex items-center gap-3 px-4 py-2 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                                  <Globe size={18} className="text-blue-400 animate-pulse" />
                                  <span className="text-xs font-black text-white">LIVE TRAFFIC</span>
                               </div>
                            </div>
                         </div>
                         
                         <div className="space-y-6 relative z-10">
                            {visitorStats.length > 0 ? visitorStats.map((item, idx) => (
                               <div key={idx} className="group">
                                  <div className="flex items-center gap-4 mb-2">
                                     <div className="w-10 text-center text-xl shrink-0">{item.flag}</div>
                                     <div className="flex-1">
                                        <div className="flex justify-between items-center mb-2">
                                           <div className="flex items-baseline gap-2">
                                              <span className="text-xs font-black text-white uppercase tracking-widest">{item.countryName}</span>
                                              <span className="text-[10px] font-black text-slate-500 uppercase">{item.countryCode}</span>
                                           </div>
                                           <div className="flex items-center gap-3">
                                              <span className="text-sm font-black text-blue-400">{item.count.toLocaleString()}</span>
                                              <span className="text-[10px] font-black text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-md">LIVE</span>
                                           </div>
                                        </div>
                                        <div className="relative h-2 w-full bg-white/[0.03] rounded-full overflow-hidden border border-white/10">
                                           <motion.div 
                                              initial={{ width: 0 }}
                                              animate={{ width: `${(item.count / (visitorStats[0]?.count || 1)) * 100}%` }}
                                              transition={{ duration: 1, delay: idx * 0.1 }}
                                              className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-600 to-indigo-400 rounded-full shadow-[0_0_15px_rgba(37,99,235,0.3)]"
                                           />
                                        </div>
                                     </div>
                                  </div>
                               </div>
                            )) : (
                               <div className="py-20 text-center">
                                  <p className="text-xs text-slate-600 uppercase tracking-widest font-black">No visitors tracked yet</p>
                               </div>
                            )}
                         </div>
                      </div>
                   </div>

                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                         {/* Top Products */}
                        <div className="bg-[#0a1120] border border-white/5 p-8 rounded-[32px] shadow-2xl relative overflow-hidden">
                           <div className="absolute bottom-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full -mb-32 -mr-32 blur-3xl" />
                           
                           <h3 className="text-xl font-black text-white uppercase tracking-tight mb-8 relative z-10">Top Performers</h3>
                           <div className="space-y-4 relative z-10">
                              {topProducts.length > 0 ? topProducts.map((p, i) => {
                                 const maxCount = topProducts[0].count;
                                 const percentage = (p.count / maxCount) * 100;
                                 return (
                                    <div key={i} className="p-5 rounded-2xl bg-white/5 border border-white/5 hover:border-blue-500/30 transition-all group relative overflow-hidden">
                                       <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                       <div className="flex items-center gap-5 relative z-10">
                                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg ${
                                             i === 0 ? 'bg-yellow-500 text-black shadow-[0_0_20px_rgba(234,179,8,0.3)]' : 
                                             i === 1 ? 'bg-slate-300 text-black' : 
                                             i === 2 ? 'bg-orange-400 text-black' : 
                                             'bg-blue-600 text-white'
                                          }`}>
                                             {i + 1}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                             <div className="flex justify-between items-start mb-2">
                                                <p className="text-sm font-black text-white uppercase tracking-tight truncate group-hover:text-blue-400 transition-colors">
                                                   {p.name}
                                                </p>
                                                <span className="text-xs font-black text-blue-400 ml-4 shrink-0">
                                                   {p.count} <span className="text-[10px] text-slate-500 ml-0.5">PV</span>
                                                </span>
                                             </div>
                                             <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                                <motion.div 
                                                   initial={{ width: 0 }}
                                                   animate={{ width: `${percentage}%` }}
                                                   transition={{ duration: 1, delay: i * 0.1 }}
                                                   className="h-full bg-blue-500 rounded-full"
                                                />
                                             </div>
                                          </div>
                                       </div>
                                    </div>
                                 );
                              }) : (
                                 <div className="py-20 text-center">
                                    <div className="flex justify-center mb-4">
                                       <Package size={40} className="text-slate-800" />
                                    </div>
                                    <p className="text-xs text-slate-600 uppercase tracking-widest font-black">Waiting for Data Stream</p>
                                 </div>
                              )}
                           </div>
                        </div>
                     </div>
                  </div>
               )}

               {adminSubView === 'products' && (
                  <div className="bg-[#0a1120] border border-white/5 rounded-[32px] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-5 duration-500">
                     <div className="p-8 border-b border-white/5 flex flex-wrap justify-between items-center gap-6">
                        <div>
                           <h3 className="text-xl font-black text-white uppercase tracking-tight">Product Catalog</h3>
                           <p className="text-xs text-slate-500 uppercase font-black mt-1">Manage {allProducts.length} live items</p>
                        </div>
                        <div className="flex gap-3">
                           {confirmDeleteAll ? (
                              <div className="flex gap-2 animate-in zoom-in-95 duration-200">
                                 <button 
                                    onClick={deleteAllProducts}
                                    className="px-5 py-3 rounded-xl bg-rose-600 text-white hover:bg-rose-500 transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                                 >
                                    CONFIRM DELETE ALL
                                 </button>
                                 <button 
                                    onClick={() => setConfirmDeleteAll(false)}
                                    className="px-5 py-3 rounded-xl border border-white/10 text-white hover:bg-white/5 transition-all text-[10px] font-black uppercase tracking-widest"
                                 >
                                    CANCEL
                                 </button>
                              </div>
                           ) : (
                              <button 
                                 onClick={() => setConfirmDeleteAll(true)} 
                                 disabled={isDeletingAll}
                                 className="px-5 py-3 rounded-xl border border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-50"
                              >
                                 {isDeletingAll ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} 
                                 {isDeletingAll ? "Deleting..." : "Clear All"}
                              </button>
                           )}
                           <button onClick={() => { 
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
                                 rating: "5.0",
                                 review_count: "1",
                                 trust_badge: "Curated"
                              }); 
                              setIsManualAdding(true); 
                           }} className="px-5 py-3 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-emerald-600/20">
                              <Plus size={16} /> New Product
                           </button>
                        </div>
                     </div>

                     {isManualAdding ? (
                        <div className="p-8 space-y-8 animate-in zoom-in-95 duration-300">
                           <div className="flex justify-between items-center mb-4">
                              <h4 className="text-white font-black uppercase text-sm tracking-widest flex items-center gap-3">
                                 {manualProduct.id ? <SettingsIcon className="text-blue-400" size={20} /> : <Plus className="text-emerald-400" size={20} />}
                                 {manualProduct.id ? "Update Product" : "Create New Item"}
                              </h4>
                              <button onClick={() => setIsManualAdding(false)} className="p-2 text-slate-500 hover:text-white"><X size={20} /></button>
                           </div>
                           
                           {/* Re-use similar form but cleaner */}
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                              <div className="space-y-6">
                                 <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Name</label>
                                    <input type="text" value={manualProduct.name} onChange={e => setManualProduct({...manualProduct, name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm outline-none focus:border-blue-500 transition-all font-light" placeholder="Product Title" />
                                 </div>
                                 <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Price ($)</label>
                                       <input type="text" value={manualProduct.price} onChange={e => setManualProduct({...manualProduct, price: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm outline-none focus:border-blue-500 transition-all" placeholder="299.99" />
                                    </div>
                                    <div className="space-y-2">
                                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Category</label>
                                       <select 
                                          value={manualProduct.category} 
                                          onChange={e => setManualProduct({...manualProduct, category: e.target.value})} 
                                          className="w-full bg-slate-900 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm outline-none focus:border-blue-500 transition-all"
                                       >
                                          {CATEGORIES.map(c => (
                                             <option key={c.id} value={c.name} className="bg-slate-900 text-white">
                                                {c.name}
                                             </option>
                                          ))}
                                       </select>
                                    </div>
                                 </div>
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Main Product Image (URL preferred)</label>
                                       <input type="text" value={manualProduct.image_url} onChange={e => setManualProduct({...manualProduct, image_url: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm outline-none focus:border-blue-500 transition-all font-light" placeholder="https://..." />
                                    </div>
                                    <div className="space-y-2">
                                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Video Link (YouTube/Direct)</label>
                                       <input type="text" value={manualProduct.video_url} onChange={e => setManualProduct({...manualProduct, video_url: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm outline-none focus:border-blue-500 transition-all font-light" placeholder="https://..." />
                                    </div>
                                 </div>
                                 <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Brand</label>
                                       <input type="text" value={manualProduct.brand} onChange={e => setManualProduct({...manualProduct, brand: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm outline-none focus:border-blue-500 transition-all font-light" placeholder="e.g. Apple" />
                                    </div>
                                    <div className="space-y-2">
                                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Rating (0-5)</label>
                                       <input type="text" value={manualProduct.rating} onChange={e => setManualProduct({...manualProduct, rating: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm outline-none focus:border-blue-500 transition-all font-light" placeholder="4.9" />
                                    </div>
                                 </div>
                              </div>
                              <div className="space-y-6">
                                 <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Affiliate Link</label>
                                    <input type="text" value={manualProduct.affiliate_link} onChange={e => setManualProduct({...manualProduct, affiliate_link: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm outline-none focus:border-blue-500 transition-all font-light" placeholder="https://..." />
                                 </div>
                                 <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Description</label>
                                    <textarea value={manualProduct.description} onChange={e => setManualProduct({...manualProduct, description: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm outline-none focus:border-blue-500 transition-all h-40 resize-none font-light leading-relaxed" placeholder="Short pitch..." />
                                 </div>
                              </div>
                           </div>

                           {/* Product Gallery Section */}
                           <div className="pt-8 border-t border-white/5 space-y-6">
                              <div className="flex justify-between items-end">
                                 <div className="space-y-1">
                                    <h5 className="text-white font-black uppercase text-xs tracking-widest">Product Gallery</h5>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Upload up to 10 photos of this item</p>
                                 </div>
                                 <label className="px-5 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-500 transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-2 cursor-pointer shadow-lg shadow-blue-600/20">
                                    <ImagePlus size={16} /> Upload Photos
                                    <input 
                                       type="file" 
                                       multiple 
                                       accept="image/*" 
                                       className="hidden" 
                                       onChange={handleImageUpload}
                                       disabled={(manualProduct.images?.length || 0) >= 10}
                                    />
                                 </label>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                                 {(manualProduct.images || []).map((img, idx) => (
                                    <div key={idx} className="aspect-square rounded-[24px] bg-white/[0.03] border border-white/5 relative group overflow-hidden">
                                       <img src={img} className="w-full h-full object-contain p-4" />
                                       <div className="absolute inset-0 bg-slate-950/80 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-2">
                                          <button 
                                             onClick={() => setManualProduct({...manualProduct, image_url: img})}
                                             className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${manualProduct.image_url === img ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
                                          >
                                             {manualProduct.image_url === img ? 'MAIN IMAGE' : 'SET AS MAIN'}
                                          </button>
                                          <button 
                                             onClick={() => {
                                                const newImages = [...(manualProduct.images || [])];
                                                newImages.splice(idx, 1);
                                                setManualProduct({...manualProduct, images: newImages, image_url: manualProduct.image_url === img ? (newImages[0] || "") : manualProduct.image_url});
                                             }}
                                             className="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white transition-all text-[8px] font-black uppercase tracking-widest"
                                          >
                                             REMOVE
                                          </button>
                                       </div>
                                       {manualProduct.image_url === img && (
                                          <div className="absolute top-2 left-2 px-2 py-1 bg-emerald-500 rounded-full text-[6px] font-black text-white uppercase tracking-widest">
                                             Thumbnail
                                          </div>
                                       )}
                                    </div>
                                 ))}
                                 {Array.from({ length: 10 - (manualProduct.images?.length || 0) }).map((_, i) => (
                                    <div key={`empty-${i}`} className="aspect-square rounded-[24px] bg-white/[0.01] border border-dashed border-white/10 flex flex-col items-center justify-center">
                                       <ImagePlus size={20} className="text-slate-800 mb-2" />
                                       <span className="text-[8px] font-black text-slate-700 uppercase tracking-widest">Photo { (manualProduct.images?.length || 0) + i + 1 }</span>
                                    </div>
                                 ))}
                              </div>
                           </div>

                           <div className="pt-10 border-t border-white/5">
                              <button onClick={handleManualAdd} className="w-full py-6 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-[0.3em] shadow-2xl shadow-emerald-600/20 transition-all active:scale-[0.98]">
                                 {manualProduct.id ? 'Save Product Updates' : 'Publish New Item'}
                              </button>
                           </div>
                        </div>
                     ) : (
                        <div className="p-0 overflow-x-auto">
                           <table className="w-full">
                              <thead>
                                 <tr className="bg-white/[0.02] text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-white/5">
                                    <th className="px-8 py-5 text-left">Item</th>
                                    <th className="px-8 py-5 text-left">Category</th>
                                    <th className="px-8 py-5 text-left">Price</th>
                                    <th className="px-8 py-5 text-left">Status</th>
                                    <th className="px-8 py-5 text-right">Actions</th>
                                 </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5">
                                 {currentItems.map((p, i) => (
                                    <tr key={p.id} className="group hover:bg-white/[0.02] transition-colors">
                                       <td className="px-8 py-5">
                                          <div className="flex items-center gap-4">
                                             <div className="w-12 h-12 rounded-xl bg-white p-1 overflow-hidden shrink-0 border border-white/10">
                                                <img src={p.image_url} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                                             </div>
                                             <div className="min-w-0">
                                                <p className="text-sm font-bold text-white truncate max-w-[200px]">{p.name}</p>
                                                <p className="text-[10px] text-slate-500 font-mono">{p.asin || 'MANUAL'}</p>
                                             </div>
                                          </div>
                                       </td>
                                       <td className="px-8 py-5">
                                          <span className="text-[10px] font-black uppercase text-slate-400 bg-white/5 px-3 py-1 rounded-full border border-white/5">{p.category}</span>
                                       </td>
                                       <td className="px-8 py-5 text-sm font-black text-white">${p.price}</td>
                                       <td className="px-8 py-5">
                                          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-400">
                                             <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                             Active
                                          </div>
                                       </td>
                                       <td className="px-8 py-5">
                                          <div className="flex justify-end gap-2">
                                              {confirmDeleteId === p.id ? (
                                                 <div className="flex gap-1 animate-in slide-in-from-right-4 duration-200">
                                                    <button 
                                                       onClick={() => deleteProduct(p.id)}
                                                       className="px-3 py-2 rounded-lg bg-rose-600 text-white text-[9px] font-black uppercase tracking-widest"
                                                    >
                                                       DEL
                                                    </button>
                                                    <button 
                                                       onClick={() => setConfirmDeleteId(null)}
                                                       className="px-3 py-2 rounded-lg bg-white/10 text-white text-[9px] font-black uppercase tracking-widest"
                                                    >
                                                       ESC
                                                    </button>
                                                 </div>
                                              ) : (
                                                 <>
                                                    <button onClick={() => { setSelectedProduct(p); setView('product'); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="p-2.5 rounded-xl bg-blue-400/5 text-blue-400 hover:bg-blue-400 hover:text-white transition-all"><Eye size={16} /></button>
                                                    <button onClick={() => handleEditProduct(p)} className="p-2.5 rounded-xl bg-emerald-400/5 text-emerald-400 hover:bg-emerald-400 hover:text-white transition-all"><SettingsIcon size={16} /></button>
                                                    <button 
                                                       onClick={() => setConfirmDeleteId(p.id!)} 
                                                       disabled={deletingProductId === p.id}
                                                       className="p-2.5 rounded-xl bg-rose-400/5 text-rose-400 hover:bg-rose-400 hover:text-white transition-all disabled:opacity-50"
                                                    >
                                                       {deletingProductId === p.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                                    </button>
                                                 </>
                                              )}
                                          </div>
                                       </td>
                                    </tr>
                                 ))}
                              </tbody>
                           </table>
                           
                           {/* Pagination Bar */}
                           <div className="p-8 bg-white/[0.02] border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
                              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                 Displaying {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, products?.length || 0)} of {products?.length || 0} Products
                              </p>
                              <div className="flex gap-3">
                                 <button 
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(prev => prev - 1)}
                                    className="px-6 py-3 rounded-xl border border-white/10 text-white text-[10px] font-black uppercase tracking-widest hover:bg-white/5 disabled:opacity-30 transition-all"
                                 >
                                    Previous
                                 </button>
                                 <button 
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage(prev => prev + 1)}
                                    className="px-6 py-3 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 shadow-xl shadow-blue-600/20 disabled:opacity-30 transition-all"
                                 >
                                    Next Page
                                 </button>
                              </div>
                           </div>
                        </div>
                     )}
                  </div>
               )}

                {adminSubView === 'profile' && (
                  <div className="bg-[#0a1120] border border-white/5 rounded-[32px] p-10 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl">
                     <div className="flex flex-col md:flex-row gap-8">
                        <div className="md:w-1/3 text-center border-b md:border-b-0 md:border-r border-white/5 pb-8 md:pb-0 md:pr-8">
                           <div className="w-24 h-24 bg-blue-600/20 text-blue-400 rounded-full flex items-center justify-center mx-auto mb-6 border border-blue-500/20 shadow-2xl shadow-blue-500/10">
                              <UserIcon size={48} />
                           </div>
                           <h2 className="text-xl font-black text-white uppercase tracking-tight mb-2">Administrator</h2>
                           <p className="text-[9px] text-emerald-400 font-bold uppercase tracking-widest bg-emerald-400/5 px-3 py-1 rounded-full border border-emerald-400/10 inline-block mb-6">Full Access</p>
                           
                           <div className="bg-slate-950/50 border border-white/5 rounded-2xl p-4 text-left">
                              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Active Email</p>
                              <p className="text-blue-400 font-bold text-sm truncate">{user?.email}</p>
                           </div>

                           <div className="mt-8">
                              <button 
                                 onClick={() => { logout(); }}
                                 className="w-full py-4 border border-rose-500/20 text-rose-500 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all hover:bg-rose-500 hover:text-white"
                              >
                                 Logout Session
                              </button>
                           </div>
                        </div>

                        <div className="md:flex-1 space-y-6">
                           <div>
                              <h3 className="text-lg font-black text-white uppercase tracking-tight mb-1">Security Credentials</h3>
                              <p className="text-[10px] text-slate-500 font-medium tracking-tight">Modify your administrative access credentials.</p>
                           </div>

                           <form onSubmit={handleChangePassword} className="space-y-4">
                              <div className="space-y-2">
                                 <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">New Security Password</label>
                                 <input 
                                    type="password" 
                                    value={newPasswordInput}
                                    onChange={(e) => setNewPasswordInput(e.target.value)}
                                    className="w-full bg-slate-950 border border-white/10 rounded-2xl px-6 py-4 text-white text-sm outline-none focus:border-blue-500 transition-all"
                                    placeholder="Enter new password (min 6 chars)"
                                 />
                              </div>
                              <button 
                                 type="submit"
                                 disabled={isUpdatingPassword}
                                 className="w-full py-4 bg-white text-slate-950 hover:bg-blue-400 hover:text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                              >
                                 {isUpdatingPassword ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
                                 Update Access Password
                              </button>
                              <p className="text-[9px] text-slate-600 italic px-2 leading-relaxed">
                                 Note: If the update fails, you may need to logout and log back in to verify your identity before changing the password.
                              </p>
                           </form>
                        </div>
                     </div>
                  </div>
               )}

               {adminSubView === 'settings' && (
                  <div className="max-w-5xl animate-in fade-in duration-500">
                     <div className="bg-[#0a1120] border border-white/5 rounded-[32px] p-10 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-[-10%] right-[-10%] opacity-[0.03] pointer-events-none">
                           <SettingsIcon size={300} />
                        </div>
                        <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-2">Platform Settings</h3>
                        <p className="text-sm text-slate-500 mb-10 font-light">Global configuration for affiliate tracking and site-wide logic.</p>
                        
                        <div className="space-y-8">
                           <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 space-y-6">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                 <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Store Name</label>
                                    <input 
                                       type="text" 
                                       value={settings.storeName}
                                       onChange={(e) => setSettings({ ...settings, storeName: e.target.value })}
                                       className="w-full bg-slate-950/50 border border-white/10 rounded-2xl px-6 py-5 text-white font-bold text-base focus:border-blue-500 outline-none transition-all"
                                       placeholder="USA Smart Gadget"
                                    />
                                 </div>
                                 <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Amazon Associate ID</label>
                                     <div className="relative group">
                                        <input 
                                           type="text" 
                                           value={settings.affiliateTag}
                                           onChange={(e) => setSettings({ ...settings, affiliateTag: e.target.value })}
                                           className="w-full bg-slate-950/50 border border-white/10 rounded-2xl px-6 py-5 text-white font-mono text-base focus:border-blue-500 outline-none transition-all placeholder:text-slate-700"
                                           placeholder="YOUR_ID-21"
                                        />
                                        <Zap className="absolute right-6 top-1/2 -translate-y-1/2 text-blue-500/20 group-focus-within:text-blue-500 transition-colors" size={20} />
                                     </div>
                                  </div>
                               </div>

                               <div className="space-y-6 mt-12 bg-emerald-500/5 border border-emerald-500/10 rounded-3xl p-8">
                                  <div className="flex items-center gap-3 mb-2">
                                     <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                                        <DollarSign className="text-emerald-500" size={20} />
                                     </div>
                                     <div className="text-left">
                                        <h4 className="text-lg font-black text-white uppercase tracking-tight">Advertisement Configuration</h4>
                                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Manage your Adsterra scripts</p>
                                     </div>
                                  </div>
                                  
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        {/* Ad Slot 1 */}
                                        <div className="space-y-6 p-6 rounded-2xl bg-slate-900/40 border border-white/5 overflow-hidden relative">
                                           <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/40"></div>
                                           <div className="flex items-center justify-between mb-2">
                                              <h5 className="text-xs font-black text-blue-400 uppercase tracking-widest">AD SLOT 1 (LEFT/TOP)</h5>
                                              <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 text-[8px] font-black uppercase">Primary</span>
                                           </div>

                                           <div className="space-y-3 text-left">
                                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">PASTE AD SCRIPT CODE 1</label>
                                              <div className="relative">
                                                 <textarea 
                                                    value={settings.adsterraCode || ''}
                                                    onChange={(e) => setSettings({ ...settings, adsterraCode: e.target.value })}
                                                    className="w-full bg-slate-950/50 border border-white/10 rounded-2xl px-6 py-6 text-white font-mono text-[10px] focus:border-blue-500 outline-none transition-all min-h-[140px] placeholder:text-slate-800"
                                                    placeholder="Paste full script for Slot 1..."
                                                 />
                                              </div>
                                           </div>

                                           <div className="space-y-3 text-left">
                                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">Or Adsterra Key 1</label>
                                              <div className="relative group">
                                                 <input 
                                                    type="text" 
                                                    value={settings.adsterraKey || ''}
                                                    onChange={(e) => setSettings({ ...settings, adsterraKey: e.target.value })}
                                                    className="w-full bg-slate-950/50 border border-white/10 rounded-2xl px-6 py-5 text-white font-mono text-xs focus:border-blue-500 outline-none transition-all placeholder:text-slate-700"
                                                    placeholder="Enter Key 1"
                                                 />
                                              </div>
                                           </div>
                                        </div>

                                        {/* Ad Slot 2 */}
                                        <div className="space-y-6 p-6 rounded-2xl bg-slate-900/40 border border-white/5 overflow-hidden relative">
                                           <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/40"></div>
                                           <div className="flex items-center justify-between mb-2">
                                              <h5 className="text-xs font-black text-emerald-400 uppercase tracking-widest">AD SLOT 2 (RIGHT/BOTTOM)</h5>
                                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase">Secondary</span>
                                           </div>

                                           <div className="space-y-3 text-left">
                                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">PASTE AD SCRIPT CODE 2</label>
                                              <div className="relative">
                                                 <textarea 
                                                    value={settings.adsterraCode2 || ''}
                                                    onChange={(e) => setSettings({ ...settings, adsterraCode2: e.target.value })}
                                                    className="w-full bg-slate-950/50 border border-white/10 rounded-2xl px-6 py-6 text-white font-mono text-[10px] focus:border-emerald-500 outline-none transition-all min-h-[140px] placeholder:text-slate-800"
                                                    placeholder="Paste full script for Slot 2..."
                                                 />
                                              </div>
                                           </div>

                                           <div className="space-y-3 text-left">
                                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">Or Adsterra Key 2</label>
                                              <div className="relative group">
                                                 <input 
                                                    type="text" 
                                                    value={settings.adsterraKey2 || ''}
                                                    onChange={(e) => setSettings({ ...settings, adsterraKey2: e.target.value })}
                                                    className="w-full bg-slate-950/50 border border-white/10 rounded-2xl px-6 py-5 text-white font-mono text-xs focus:border-emerald-500 outline-none transition-all placeholder:text-slate-700"
                                                    placeholder="Enter Key 2"
                                                  />
                                               </div>
                                            </div>
                                         </div>
                                      </div>
                                   </div>

                               <div className="space-y-3">
                                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Store Logo</label>
                                 <div className="flex flex-col md:flex-row gap-6 items-center">
                                    <div className="w-32 h-32 rounded-2xl bg-white p-4 flex items-center justify-center shrink-0 border border-white/10">
                                       {settings.logoURL ? (
                                          <img src={settings.logoURL} alt="Preview" className="w-full h-full object-contain" />
                                       ) : (
                                          <div className="text-slate-300 text-[10px] font-black uppercase text-center">No Logo</div>
                                       )}
                                    </div>
                                    <div className="flex-1 space-y-4 w-full">
                                       <input 
                                          type="text" 
                                          value={settings.logoURL}
                                          onChange={(e) => setSettings({ ...settings, logoURL: e.target.value })}
                                          className="w-full bg-slate-950/50 border border-white/10 rounded-2xl px-6 py-4 text-white text-xs outline-none focus:border-blue-500 transition-all"
                                          placeholder="Logo URL (https://...) or Base64"
                                       />
                                       <div className="flex items-center gap-4">
                                          <label className="flex-1">
                                             <div className="flex items-center justify-center gap-2 py-4 bg-white/5 border border-dashed border-white/20 rounded-2xl cursor-pointer hover:bg-white/10 transition-all">
                                                <ImagePlus size={18} className="text-slate-400" />
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Upload File</span>
                                             </div>
                                             <input 
                                                type="file" 
                                                className="hidden" 
                                                accept="image/*"
                                                onChange={(e) => {
                                                   const file = e.target.files?.[0];
                                                   if (file) {
                                                      const reader = new FileReader();
                                                      reader.onloadend = () => {
                                                         setSettings({ ...settings, logoURL: reader.result as string });
                                                      };
                                                      reader.readAsDataURL(file);
                                                   }
                                                }}
                                             />
                                          </label>
                                          {settings.logoURL && (
                                             <button 
                                                onClick={() => setSettings({ ...settings, logoURL: "" })}
                                                className="px-6 py-4 rounded-2xl bg-rose-500/10 text-rose-500 text-[10px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all shadow-xl shadow-rose-500/10"
                                             >
                                                Reset
                                             </button>
                                          )}
                                       </div>
                                    </div>
                                 </div>
                                 <p className="text-[9px] text-slate-600 font-medium italic">
                                    * Recommended: Square or Landscape logo on a transparent or white background. Max 500kb.
                                 </p>
                              </div>
                              
                              <button 
                                 onClick={() => { saveSettings(settings); alert("Configuration updated successfully!"); }}
                                 className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-blue-600/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                              >
                                 <Save size={18} /> Update Configuration
                              </button>
                           </div>

                           <div className="p-6 bg-rose-500/5 border border-rose-500/10 rounded-2xl">
                              <div className="flex items-start gap-4">
                                 <div className="p-3 bg-rose-500/10 text-rose-500 rounded-xl">
                                    <Info size={20} />
                                 </div>
                                 <div>
                                    <h4 className="text-xs font-black text-white uppercase tracking-widest mb-1">Danger Zone</h4>
                                    <p className="text-[10px] text-slate-500 leading-relaxed max-w-sm">
                                       Use the 'Clear All' button in the Products catalog to reset your database. This action is irreversible.
                                    </p>
                                 </div>
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>
               )}
            </div>
        </main>
        )
      ) : (
        /* Amazon Style Product Detail Page */
        <main className="pt-4 md:pt-8 bg-[#f8f9fa] min-h-screen">
          <div className="max-w-[1300px] mx-auto px-4 md:px-6 pb-12">
            {/* Breadcrumbs */}
            <nav className="flex items-center gap-2 text-[10px] md:text-[11px] text-slate-500 mb-4 py-2 overflow-x-auto whitespace-nowrap scrollbar-hide border-b border-slate-100/50">
               <button onClick={() => { setView('home'); setSelectedProduct(null); }} className="hover:text-blue-600 flex items-center gap-1.5 transition-colors font-bold">
                 <Home size={12} className="shrink-0" /> Smart Store
               </button>
               <ChevronRight size={10} className="shrink-0 opacity-40" />
               <button onClick={() => { setView('home'); setSelectedProduct(null); }} className="hover:text-blue-600 transition-colors font-bold uppercase tracking-tighter">Electronics</button>
               <ChevronRight size={10} className="shrink-0 opacity-40" />
               <span className="text-slate-400 truncate max-w-[150px] md:max-w-none">{selectedProduct?.name}</span>
            </nav>

            <div className="flex flex-col lg:flex-row gap-6 lg:gap-10">
               {/* Left: Images */}
               <div className="lg:w-[40%]">
                  <div className="flex flex-col md:flex-row gap-4 lg:sticky lg:top-24">
                     {/* Horizontal Thumbnails for Mobile, Vertical for Desktop */}
                     <div className="order-2 md:order-1 flex md:flex-col gap-3 shrink-0 overflow-x-auto md:max-h-[600px] scrollbar-hide py-2 md:py-0">
                        {[selectedProduct?.image_url, ...(selectedProduct?.images || [])].filter(Boolean).map((img, i) => (
                          <div 
                            key={i} 
                            onMouseEnter={() => setMainImage(img as string)}
                            onClick={() => setMainImage(img as string)}
                            className={`w-12 h-12 md:w-16 md:h-16 shrink-0 border-2 ${mainImage === img ? "border-orange-500 ring-4 ring-orange-500/5" : "border-slate-100"} rounded-xl p-2 cursor-pointer hover:border-orange-500 transition-all bg-white flex items-center justify-center overflow-hidden shadow-sm`}
                          >
                              <img src={img as string} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                          </div>
                        ))}
                     </div>

                     {/* Main Display Container */}
                     <div className="order-1 md:order-2 flex-1 bg-white border border-slate-100 rounded-2xl flex items-center justify-center group relative overflow-hidden shadow-xl shadow-slate-200/30 min-h-[300px] md:min-h-[450px]">
                        <img 
                          src={mainImage || selectedProduct?.image_url} 
                          alt={selectedProduct?.name} 
                          referrerPolicy="no-referrer" 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" 
                        />
                        {selectedProduct?.discount_percentage && (
                          <div className="absolute top-6 left-6 bg-rose-600 text-white text-xs font-black px-3 py-1.5 rounded-lg shadow-lg shadow-rose-500/20">
                            -{selectedProduct.discount_percentage} OFF
                          </div>
                        )}
                     </div>
                  </div>
               </div>

               {/* Right: Detailed Info & Buy Box */}
               <div className="flex-1 flex flex-col xl:flex-row gap-8 lg:pt-2">
                  {/* Center: Info */}
                  <div className="xl:flex-1 space-y-4">
                     <div className="space-y-3">
                       <h1 className="text-xl md:text-2xl font-display font-black text-slate-900 leading-tight">
                         {selectedProduct?.name}
                       </h1>
                       <div className="flex items-center gap-2 flex-wrap">
                          <p className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[9px] font-black uppercase tracking-widest rounded border border-blue-100">{selectedProduct?.brand || "Official Store"}</p>
                          <span className="text-slate-300">|</span>
                          <div className="flex items-center gap-2">
                             <div className="flex items-center">
                                {[1,2,3,4,5].map(s => <Star key={s} size={13} className={s <= Math.round(parseFloat(selectedProduct?.rating || "4.5")) ? "text-orange-400 fill-orange-400" : "text-slate-200 fill-slate-200"} />)}
                             </div>
                             <span className="text-blue-600 text-[10px] font-bold hover:underline cursor-pointer">{selectedProduct?.review_count || "12,450 ratings"}</span>
                          </div>
                       </div>
                     </div>

                     <div className="space-y-6">
                        <div className="flex flex-col gap-1">
                           <div className="flex items-baseline gap-3">
                              {selectedProduct?.discount_percentage && (
                                <span className="text-rose-600 text-3xl font-light tracking-tighter">-{selectedProduct.discount_percentage}</span>
                              )}
                              <div className="flex items-baseline gap-0.5">
                                 <span className="text-xs text-slate-900 font-black self-start mt-1">$</span>
                                 <span className="text-3xl font-black text-slate-900 tracking-tighter">{parsePrice(selectedProduct?.price).whole}</span>
                                 <span className="text-xs text-slate-900 font-black self-start mt-1">{parsePrice(selectedProduct?.price).fraction}</span>
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

                      <div className="p-4 bg-[#f0f2f2] rounded-2xl border border-slate-200 flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white shrink-0 shadow-sm">
                             <TrendingUp size={16} />
                           </div>
                           <div>
                              <p className="text-xs font-black text-emerald-900 uppercase tracking-tight">Highly Popular</p>
                              <p className="text-[10px] text-slate-600 font-medium leading-tight">5,000+ items sold on Amazon US last month</p>
                           </div>
                        </div>
                     </div>

                     <div className="space-y-6 pt-10 border-t border-slate-100">
                        <div className="flex items-center gap-2 mb-4">
                           <h3 className="font-black text-slate-900 text-xs uppercase tracking-[0.25em]">Core Specifications</h3>
                           <div className="group relative">
                              <Info size={12} className="text-slate-300 cursor-help" />
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-900 text-white text-[9px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 font-medium">
                                Key technical details and physical attributes of the product at a glance.
                              </div>
                           </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                           {(selectedProduct?.highlights || [
                              { label: 'Color', value: 'Original' },
                              { label: 'Brand', value: selectedProduct?.brand || 'Premium' },
                              { label: 'Availability', value: 'In Stock' },
                              { label: 'Warranty', value: '1 Year' }
                           ]).map((feat: any, i) => (
                              <div key={i} className="flex flex-col p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-slate-200 transition-colors">
                                 <span className="text-[8px] text-slate-400 font-black uppercase tracking-tighter mb-0.5">{feat.label}</span>
                                 <span className="text-[10px] text-slate-900 font-bold truncate">{feat.value}</span>
                              </div>
                           ))}
                        </div>
                        <div className="pt-6 space-y-4">
                           <h3 className="font-black text-slate-900 text-xs uppercase tracking-[0.25em]">Product Description</h3>
                           <ul className="space-y-3 text-xs text-slate-600 leading-relaxed font-medium bg-white p-5 rounded-2xl border border-slate-100">
                              {((selectedProduct?.description_bullets && selectedProduct.description_bullets.length > 0) 
                                ? selectedProduct.description_bullets 
                                : (selectedProduct?.description ? selectedProduct.description.split('.').filter(s => s.trim()) : [
                                    "Highly innovative design built for maximum performance and durability.",
                                    "Ergonomic features ensured for top-tier comfort and daily usability.",
                                    "Sourced from premium materials to provide a long-lasting life cycle.",
                                    "Seamless integration with modern lifestyle ecosystem for efficiency."
                                  ])).map((desc, i) => (
                                 <li key={i} className="flex gap-3">
                                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0 shadow-sm shadow-orange-500/20" />
                                    <span>{desc.trim()}.</span>
                                 </li>
                              ))}
                           </ul>
                        </div>
                     </div>
                  </div>

                  {/* Buy Box - Sticky on Desktop */}
                  <div className="xl:w-[320px] shrink-0">
                     <div className="border border-slate-200 rounded-2xl p-6 md:p-8 space-y-6 bg-white sticky top-24 shadow-2xl shadow-slate-300/10 ring-1 ring-slate-100">
                        <div className="space-y-4">
                           <div className="flex items-baseline gap-1">
                              <span className="text-sm text-slate-900 font-black">$</span>
                              <span className="text-3xl font-black text-slate-900 tracking-tighter">{parsePrice(selectedProduct?.price).whole}.{parsePrice(selectedProduct?.price).fraction}</span>
                           </div>
                           <div className="space-y-3">
                              <p className="text-[10px] text-blue-600 font-black flex items-center gap-2 hover:bg-blue-50 px-2 py-1 rounded transition-colors w-fit -ml-2 cursor-pointer"><ShieldCheck size={16} /> FREE Returns</p>
                              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2.5">
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
                              <button className="flex items-center gap-2 text-blue-600 text-[10px] font-black uppercase tracking-widest hover:underline pt-2">
                                 <MapPin size={12} className="text-rose-500" /> Deliver to United States
                              </button>
                           </div>
                        </div>

                        <div className="flex items-center gap-2">
                           <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                           <span className="text-emerald-700 font-black text-xs uppercase tracking-widest">In Stock</span>
                        </div>

                        <div className="space-y-4">
                           <button className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-2 px-4 flex items-center justify-between text-[10px] font-black text-slate-900 hover:bg-slate-100 hover:border-slate-200 transition-all">
                              <span className="uppercase tracking-widest">Quantity: 1</span>
                              <ChevronDown size={16} />
                           </button>
                           
                           <div className="grid gap-3">
                              <a 
                                href={selectedProduct?.affiliate_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => selectedProduct && logClick(selectedProduct.id)}
                                className="w-full h-11 bg-[#FFD814] hover:bg-[#F7CA00] text-slate-900 rounded-xl shadow-lg shadow-yellow-500/10 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                              >
                                 View on Amazon
                              </a>
                              <a 
                                href={selectedProduct?.affiliate_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => selectedProduct && logClick(selectedProduct.id)}
                                className="w-full h-11 bg-[#FFA41C] hover:bg-[#FA8900] text-white rounded-xl shadow-lg shadow-orange-500/10 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
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
                              <span className="text-slate-900 font-black text-blue-600 hover:underline cursor-pointer">SmartGadget_USA</span>
                           </div>
                           <div className="pt-2 flex items-center justify-center gap-2 bg-slate-50 py-2 rounded-xl border border-slate-100">
                             <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Verified Link</span>
                             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                             <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Amazon Official Affiliate</span>
                           </div>
                        </div>

                        {/* Share Product Section */}
                        <div className="pt-6 border-t border-slate-100 space-y-4">
                           <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Share This Product</h4>
                           <div className="flex items-center justify-center gap-3">
                              {[
                                 { icon: Facebook, color: "hover:text-[#1877F2]", label: "Facebook", action: () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`, '_blank') },
                                 { icon: Twitter, color: "hover:text-[#1DA1F2]", label: "Twitter", action: () => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out this ${selectedProduct?.name}: `)}&url=${encodeURIComponent(window.location.href)}`, '_blank') },
                                 { icon: MessageCircle, color: "hover:text-[#25D366]", label: "WhatsApp", action: () => window.open(`https://wa.me/?text=${encodeURIComponent(`Check out this ${selectedProduct?.name}: ${window.location.href}`)}`, '_blank') },
                                 { icon: LinkIcon, color: "hover:text-blue-600", label: "Copy Link", action: () => { navigator.clipboard.writeText(window.location.href); alert("Link copied to clipboard!"); } }
                              ].map((btn, i) => (
                                 <button 
                                   key={i}
                                   onClick={btn.action}
                                   className={`w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 transition-all hover:scale-110 active:scale-95 hover:bg-white hover:shadow-lg ${btn.color}`}
                                   title={btn.label}
                                 >
                                    <btn.icon size={18} />
                                 </button>
                              ))}
                           </div>
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
                   <div className="space-y-4">
                      {[
                        { 
                          name: "Sarah Jenkins", 
                          initials: "SJ", 
                          date: "2 days ago", 
                          text: "This is easily one of my best Amazon purchases this year. The build quality is solid and it works exactly as described. Shipping was incredibly fast!",
                          rating: 5
                        },
                        { 
                          name: "M. Thompson", 
                          initials: "MT", 
                          date: "1 week ago", 
                          text: "I was hesitant at first but the performance is top-notch. Great value for money considering the features. My only regret is not buying it sooner.",
                          rating: 5
                        },
                        { 
                          name: "David K.", 
                          initials: "DK", 
                          date: "Oct 12, 2024", 
                          text: "Perfect addition to my setup. It's rare to find something that actually lives up to the hype on social media. Definitely worth every penny.",
                          rating: 4
                        }
                      ].map((rev, i) => (
                         <div key={i} className="p-5 bg-[#f8f9fa] rounded-2xl border border-slate-100 hover:border-blue-100 transition-colors">
                            <div className="flex justify-between items-start mb-3">
                               <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-[10px] font-black uppercase">
                                     {rev.initials}
                                  </div>
                                  <div>
                                     <p className="text-[11px] font-black text-slate-900 uppercase">{rev.name}</p>
                                     <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{rev.date}</p>
                                  </div>
                               </div>
                               <div className="flex gap-0.5">
                                  {[1,2,3,4,5].map(s => <Star key={s} size={10} className={s <= rev.rating ? "text-orange-400 fill-orange-400" : "text-slate-200"} />)}
                                </div>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed font-medium">"{rev.text}"</p>
                            <div className="mt-3 flex items-center gap-2">
                               <ThumbsUp size={12} className="text-slate-400" />
                               <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Helpful</span>
                            </div>
                         </div>
                      ))}
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
                  <div className="aspect-square bg-slate-50 rounded-xl mb-4 overflow-hidden flex items-center justify-center">
                    {product.image_url && <img src={product.image_url} alt={product.name} referrerPolicy="no-referrer" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />}
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
      <footer className="relative z-10 py-20 bg-slate-950/80 backdrop-blur-xl border-t border-white/5 mt-16">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-16 mb-20 text-white">
            <div className="md:col-span-2 space-y-8">
              <div className="flex items-center gap-3 mb-12">
                {settings.logoURL ? (
                  <img src={settings.logoURL} alt={settings.storeName} className="h-12 object-contain" />
                ) : (
                  <img src="/logo.png" alt="USA Smart Gadget" className="h-12 object-contain" />
                )}
                <span className="text-base md:text-xl font-display font-black text-white tracking-tight uppercase">{settings.storeName}</span>
              </div>
              <p className="text-slate-400 text-lg leading-relaxed font-light max-w-sm">
                Discover the best trending gadgets and high-quality products curated specifically for the smart living in USA. Experience modern tech with handpicked essentials.
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
                    <button onClick={() => handleCategoryFilter(cat.name)} className="text-slate-400 hover:text-indigo-400 transition-colors text-sm font-light leading-relaxed">
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
              &copy; {new Date().getFullYear()} USA Smart Gadget. Curated for smart living. <br />
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
