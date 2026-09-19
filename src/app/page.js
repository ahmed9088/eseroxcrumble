'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './page.module.css';

// Cookie Prices
const COOKIE_PRICES = {
  classic_chocolate_chip: 580,
  double_chocolate: 580,
  chocolate_chip_walnut: 580,
  cookies_cream: 620,
  kunafa_chocolate: 620,
  hazelnut_filled: 620,
  lotus_lava: 620,
  classic_bundle: 2200,
  premium_bundle: 2400,
};

const CLASSIC_FLAVORS = [
  'Classic Chocolate Chip',
  'Double Chocolate',
  'Chocolate Chip Walnut',
];

const PREMIUM_FLAVORS = [
  'Cookies & Cream',
  'Kunafa Chocolate',
  'Hazelnut Filled',
  'Lotus Lava',
];

export default function PreorderPage() {
  // Form Fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [orderType, setOrderType] = useState('takeaway'); // Default to takeaway

  // Delivery Address
  const [deliveryStreet, setDeliveryStreet] = useState('');
  const [deliveryStreet2, setDeliveryStreet2] = useState('');
  const [deliveryCity, setDeliveryCity] = useState('');
  const [deliveryState, setDeliveryState] = useState('');
  const [deliveryZip, setDeliveryZip] = useState('');
  const [deliveryLandmark, setDeliveryLandmark] = useState('');

  // Cookie Quantities
  const [quantities, setQuantities] = useState({
    classic_chocolate_chip: 0,
    double_chocolate: 0,
    chocolate_chip_walnut: 0,
    cookies_cream: 0,
    kunafa_chocolate: 0,
    hazelnut_filled: 0,
    lotus_lava: 0,
    classic_bundle: 0,
    premium_bundle: 0,
  });

  // Bundle Flavors State
  // { bundleIdx: { cookie1: 'flv', cookie2: 'flv', ... } }
  const [classicBundleChoices, setClassicBundleChoices] = useState({});
  const [premiumBundleChoices, setPremiumBundleChoices] = useState({});

  // Cookie Stock status (fetched from API)
  const [stockStatus, setStockStatus] = useState({
    classic_chocolate_chip: true,
    double_chocolate: true,
    chocolate_chip_walnut: true,
    cookies_cream: true,
    kunafa_chocolate: true,
    hazelnut_filled: true,
    lotus_lava: true,
    classic_bundle: true,
    premium_bundle: true,
  });

  // File Upload State
  const [paymentProof, setPaymentProof] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // Email Verification States
  const [otpSent, setOtpSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpSuccess, setOtpSuccess] = useState('');

  // General States
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successOrderId, setSuccessOrderId] = useState('');
  const [copiedField, setCopiedField] = useState('');
  const [announcement, setAnnouncement] = useState({ text: '', isActive: false });
  const [orderSettings, setOrderSettings] = useState({ isDeliveryEnabled: true, isPickupEnabled: true });
  const [menuItems, setMenuItems] = useState([]);
  const [activeBatchName, setActiveBatchName] = useState('Pre-Order 1');

  // Fetch Stock Status, Menu Items, Batches, and Announcement on Mount
  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/admin/stock');
        const data = await res.json();
        if (data.stock) {
          setStockStatus(data.stock);
        }
        if (data.items) {
          setMenuItems(data.items);
        }
      } catch (err) {
        console.error('Failed to load stock settings', err);
      }

      try {
        const bRes = await fetch('/api/admin/batches');
        if (bRes.ok) {
          const bData = await bRes.json();
          if (bData.activeBatch?.name) {
            setActiveBatchName(bData.activeBatch.name);
          }
        }
      } catch (bErr) {
        console.error('Failed to load batches', bErr);
      }

      try {
        const res = await fetch('/api/announcement');
        if (res.ok) {
          const data = await res.json();
          setAnnouncement(data);
        }
      } catch (err) {
        console.error('Failed to load announcement settings', err);
      }

      try {
        const res = await fetch('/api/order-settings');
        if (res.ok) {
          const data = await res.json();
          setOrderSettings(data);
          // If takeaway is disabled but delivery is enabled, default to delivery
          if (!data.isPickupEnabled && data.isDeliveryEnabled) {
            setOrderType('delivery');
          }
        }
      } catch (err) {
        console.error('Failed to load order settings', err);
      }
    }
    loadData();
  }, []);

  // Update Bundle Choice elements when quantities change
  useEffect(() => {
    // Classic Bundle Choices
    const newClassic = { ...classicBundleChoices };
    // remove indexes higher than current quantity
    Object.keys(newClassic).forEach((key) => {
      if (parseInt(key, 10) >= quantities.classic_bundle) {
        delete newClassic[key];
      }
    });
    // add missing indexes
    for (let i = 0; i < quantities.classic_bundle; i++) {
      if (!newClassic[i]) {
        newClassic[i] = [CLASSIC_FLAVORS[0], CLASSIC_FLAVORS[0], CLASSIC_FLAVORS[0], CLASSIC_FLAVORS[0]];
      }
    }
    setClassicBundleChoices(newClassic);
  }, [quantities.classic_bundle]);

  useEffect(() => {
    // Premium Bundle Choices
    const newPremium = { ...premiumBundleChoices };
    Object.keys(newPremium).forEach((key) => {
      if (parseInt(key, 10) >= quantities.premium_bundle) {
        delete newPremium[key];
      }
    });
    for (let i = 0; i < quantities.premium_bundle; i++) {
      if (!newPremium[i]) {
        newPremium[i] = [PREMIUM_FLAVORS[0], PREMIUM_FLAVORS[0], PREMIUM_FLAVORS[0], PREMIUM_FLAVORS[0]];
      }
    }
    setPremiumBundleChoices(newPremium);
  }, [quantities.premium_bundle]);

  // Copy helper
  const handleCopy = (text, fieldName) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(''), 2000);
  };

  // Format Phone Number on Input: (000) 000-00000
  const handlePhoneChange = (e) => {
    let input = e.target.value.replace(/\D/g, ''); // digits only
    if (input.length > 11) input = input.substring(0, 11);

    let formatted = '';
    if (input.length > 0) {
      formatted += '(' + input.substring(0, 3);
    }
    if (input.length > 3) {
      formatted += ') ' + input.substring(3, 6);
    }
    if (input.length > 6) {
      formatted += '-' + input.substring(6, 11);
    }
    setPhone(formatted);
  };

  // Helper to extract counts of cookies in cart (both individual and inside bundles)
  const getCartCookieCounts = (currentQuantities, classicChoices, premiumChoices) => {
    const counts = {};
    // Initialize counts for all items in quantities and stockStatus
    Object.keys(currentQuantities).forEach((k) => { counts[k] = currentQuantities[k] || 0; });
    Object.keys(stockStatus).forEach((k) => { if (counts[k] === undefined) counts[k] = currentQuantities[k] || 0; });

    const mapFriendlyToKey = (name) => {
      if (!name) return null;
      const n = name.trim().toLowerCase();
      const found = menuItems.find((i) => i.name.toLowerCase() === n || i.key.toLowerCase() === n);
      if (found) return found.key;
      if (n.includes('walnut')) return 'chocolate_chip_walnut';
      if (n.includes('classic') || n.includes('chip')) return 'classic_chocolate_chip';
      if (n.includes('double')) return 'double_chocolate';
      if (n.includes('cream')) return 'cookies_cream';
      if (n.includes('kunafa')) return 'kunafa_chocolate';
      if (n.includes('hazelnut')) return 'hazelnut_filled';
      if (n.includes('lotus') || n.includes('lava')) return 'lotus_lava';
      return null;
    };

    // Add classic bundles choices
    const classicBundleQty = currentQuantities.classic_bundle || 0;
    if (classicBundleQty > 0) {
      Object.values(classicChoices).forEach(bundleObj => {
        Object.values(bundleObj).forEach(flvFriendly => {
          const key = mapFriendlyToKey(flvFriendly);
          if (key) counts[key] = (counts[key] || 0) + 1;
        });
      });
    }

    // Add premium bundles choices
    const premiumBundleQty = currentQuantities.premium_bundle || 0;
    if (premiumBundleQty > 0) {
      Object.values(premiumChoices).forEach(bundleObj => {
        Object.values(bundleObj).forEach(flvFriendly => {
          const key = mapFriendlyToKey(flvFriendly);
          if (key) counts[key] = (counts[key] || 0) + 1;
        });
      });
    }

    return counts;
  };

  // Helper to check if a flavor is sold out (from db status)
  const isSoldOut = (key) => {
    const item = stockStatus[key];
    if (key === 'classic_bundle') {
      return !item || !item.is_active;
    }
    if (key === 'premium_bundle') {
      return !item || !item.is_active;
    }
    return !item || !item.is_active || item.available <= 0;
  };

  // Dynamic Item Price helper
  const getItemPrice = (key) => {
    return stockStatus[key]?.price ?? COOKIE_PRICES[key] ?? 580;
  };

  // Quantity Change Handlers
  const adjustQuantity = (item, diff) => {
    if (diff <= 0) {
      setQuantities((prev) => ({ ...prev, [item]: Math.max(0, (prev[item] || 0) + diff) }));
      return;
    }

    // Prevent ordering if item is completely inactive
    if (stockStatus[item] && !stockStatus[item].is_active) {
      alert(`${(stockStatus[item]?.name || item).toUpperCase()} is currently unavailable!`);
      return;
    }

    // Calculate current counts in the cart
    const currentCounts = getCartCookieCounts(quantities, classicBundleChoices, premiumBundleChoices);

    if (item === 'classic_bundle') {
      if (!stockStatus.classic_bundle?.is_active) {
        alert('Classic Bundle is currently unavailable!');
        return;
      }
      const classicItems = menuItems.filter((i) => i.category === 'classic' && i.is_active !== false);
      const totalClassicAvailable = classicItems.reduce((acc, curr) => acc + (curr.available || 0), 0) ||
        (stockStatus.classic_chocolate_chip?.available || 0) +
        (stockStatus.double_chocolate?.available || 0) +
        (stockStatus.chocolate_chip_walnut?.available || 0);
      const totalClassicOrdered = classicItems.reduce((acc, curr) => acc + (currentCounts[curr.key] || 0), 0) ||
        (currentCounts.classic_chocolate_chip || 0) +
        (currentCounts.double_chocolate || 0) +
        (currentCounts.chocolate_chip_walnut || 0);
      if (totalClassicOrdered + 4 > totalClassicAvailable) {
        alert('Sorry, there is not enough classic cookie stock left to add another bundle!');
        return;
      }
    } else if (item === 'premium_bundle') {
      if (!stockStatus.premium_bundle?.is_active) {
        alert('Premium Bundle is currently unavailable!');
        return;
      }
      const premiumItems = menuItems.filter((i) => i.category === 'premium' && i.is_active !== false);
      const totalPremiumAvailable = premiumItems.reduce((acc, curr) => acc + (curr.available || 0), 0) ||
        (stockStatus.cookies_cream?.available || 0) +
        (stockStatus.kunafa_chocolate?.available || 0) +
        (stockStatus.hazelnut_filled?.available || 0) +
        (stockStatus.lotus_lava?.available || 0);
      const totalPremiumOrdered = premiumItems.reduce((acc, curr) => acc + (currentCounts[curr.key] || 0), 0) ||
        (currentCounts.cookies_cream || 0) +
        (currentCounts.kunafa_chocolate || 0) +
        (currentCounts.hazelnut_filled || 0) +
        (currentCounts.lotus_lava || 0);
      if (totalPremiumOrdered + 4 > totalPremiumAvailable) {
        alert('Sorry, there is not enough premium cookie stock left to add another bundle!');
        return;
      }
    } else {
      // Individual cookie stock check
      const currentOrdered = currentCounts[item] || 0;
      const available = stockStatus[item]?.available || 0;
      if (currentOrdered + 1 > available) {
        alert(`Sorry, only ${available} ${stockStatus[item]?.flavor_name || stockStatus[item]?.name || item.replace('_', ' ')} are available in total!`);
        return;
      }
    }

    setQuantities((prev) => {
      const newVal = Math.max(0, (prev[item] || 0) + diff);
      return { ...prev, [item]: newVal };
    });
  };

  // Totals Calculations
  const getSubtotal = () => {
    return Object.entries(quantities).reduce((acc, [item, qty]) => {
      return acc + qty * getItemPrice(item);
    }, 0);
  };

  const getDeliveryFee = () => {
    return orderType === 'delivery' ? 300 : 0; // Flat delivery fee (PKR 300)
  };

  const getTotal = () => {
    return getSubtotal() + getDeliveryFee();
  };

  const totalItems = Object.values(quantities).reduce((a, b) => a + b, 0);

  // Auto-check returning customer email verification status
  const checkEmailVerificationStatus = async (emailToTest) => {
    if (!emailToTest || !emailToTest.includes('@') || !emailToTest.includes('.')) {
      return;
    }
    try {
      const res = await fetch(`/api/otp/check?email=${encodeURIComponent(emailToTest)}`);
      const data = await res.json();
      if (res.ok && data.isVerified) {
        setEmailVerified(true);
        setOtpSent(false);
        setOtpError('');
        setOtpSuccess(data.isExistingCustomer 
          ? '✓ You are a verified returning customer! Form unlocked.' 
          : '✓ Your email is verified! Form unlocked.');
      } else {
        setEmailVerified(false);
        setOtpSuccess('');
      }
    } catch (err) {
      console.error('Failed to check email verification status:', err);
    }
  };

  const handleEmailChange = (e) => {
    const val = e.target.value;
    setEmail(val);
    if (val.includes('@') && val.includes('.')) {
      checkEmailVerificationStatus(val);
    } else {
      setEmailVerified(false);
      setOtpSuccess('');
    }
  };

  // Email Verification Trigger
  const sendVerificationCode = async () => {
    if (!email || !email.includes('@')) {
      setOtpError('Please enter a valid email address.');
      return;
    }
    setOtpLoading(true);
    setOtpError('');
    setOtpSuccess('');
    try {
      const res = await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.isVerified) {
          setEmailVerified(true);
          setOtpSuccess('✓ You are a verified returning customer! Form unlocked.');
        } else {
          setOtpSent(true);
          const successMsg = data.devHint 
            ? `Verification code sent. ${data.devHint}`
            : 'Verification code sent to your email.';
          setOtpSuccess(successMsg);
        }
      } else {
        setOtpError(data.error || 'Failed to send OTP.');
      }
    } catch (err) {
      setOtpError('Network error. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  // OTP Verification Submit
  const verifyCode = async () => {
    if (!otpCode || otpCode.length !== 6) {
      setOtpError('Please enter the 6-digit code.');
      return;
    }
    setOtpLoading(true);
    setOtpError('');
    setOtpSuccess('');
    try {
      const res = await fetch('/api/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: otpCode }),
      });
      const data = await res.json();
      if (res.ok) {
        setEmailVerified(true);
        setOtpSuccess('Email verified successfully! Form unlocked.');
      } else {
        setOtpError(data.error || 'Invalid verification code.');
      }
    } catch (err) {
      setOtpError('Network error. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  // Drag & Drop File Handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file) => {
    // Validate file type (image or pdf)
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      alert('Please upload an image (JPG, PNG, WEBP) or a PDF file.');
      return;
    }
    // Limit to 2MB
    if (file.size > 2 * 1024 * 1024) {
      alert('File size exceeds the 2MB limit. Please upload a smaller screenshot.');
      return;
    }
    setPaymentProof(file);
  };

  const handleRemoveFile = (e) => {
    e.stopPropagation();
    setPaymentProof(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Handle Bundle Flavor Choice Update
  const updateBundleFlavor = (bundleType, bundleIdx, cookieIdx, flavor) => {
    // Helper to map friendly name to key
    const mapFriendlyToKey = (name) => {
      const n = name.trim().toLowerCase();
      if (n.includes('walnut')) return 'chocolate_chip_walnut';
      if (n.includes('classic') || n.includes('chip')) return 'classic_chocolate_chip';
      if (n.includes('double')) return 'double_chocolate';
      if (n.includes('cream')) return 'cookies_cream';
      if (n.includes('kunafa')) return 'kunafa_chocolate';
      if (n.includes('hazelnut')) return 'hazelnut_filled';
      if (n.includes('lotus') || n.includes('lava')) return 'lotus_lava';
      return null;
    };

    const targetKey = mapFriendlyToKey(flavor);
    if (targetKey) {
      if (stockStatus[targetKey] && (!stockStatus[targetKey].is_active || stockStatus[targetKey].available <= 0)) {
        alert(`Sorry, ${flavor} is currently sold out! Please select another flavor.`);
        return;
      }

      // Compute tentative choices to verify if they exceed available stock
      const tempChoices = bundleType === 'classic' 
        ? { ...classicBundleChoices, [bundleIdx]: { ...classicBundleChoices[bundleIdx], [cookieIdx]: flavor } }
        : classicBundleChoices;
      const tempPremiumChoices = bundleType === 'premium'
        ? { ...premiumBundleChoices, [bundleIdx]: { ...premiumBundleChoices[bundleIdx], [cookieIdx]: flavor } }
        : premiumBundleChoices;

      const currentCounts = getCartCookieCounts(quantities, tempChoices, tempPremiumChoices);
      const available = stockStatus[targetKey]?.available || 0;
      if (currentCounts[targetKey] > available) {
        alert(`Sorry, you cannot select another ${flavor} as only ${available} are available in total stock!`);
        return;
      }
    }

    if (bundleType === 'classic') {
      setClassicBundleChoices((prev) => {
        const choices = { ...prev };
        choices[bundleIdx][cookieIdx] = flavor;
        return choices;
      });
    } else {
      setPremiumBundleChoices((prev) => {
        const choices = { ...prev };
        choices[bundleIdx][cookieIdx] = flavor;
        return choices;
      });
    }
  };

  // Form Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (orderType === 'delivery' && !orderSettings.isDeliveryEnabled) {
      setErrorMsg('Delivery preorders are currently closed by admin.');
      return;
    }

    if (orderType === 'takeaway' && !orderSettings.isPickupEnabled) {
      setErrorMsg('Pickup / Takeaway preorders are currently closed by admin.');
      return;
    }

    if (!emailVerified) {
      setErrorMsg('Please verify your email address first.');
      return;
    }

    if (totalItems === 0) {
      setErrorMsg('Please select at least one cookie/bundle from the menu.');
      return;
    }

    if (phone.length < 15) {
      setErrorMsg('Please enter a valid phone number in the format: (000) 000-00000.');
      return;
    }

    if (!paymentProof) {
      setErrorMsg('Please upload your payment proof screenshot.');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('firstName', firstName);
      formData.append('lastName', lastName);
      formData.append('email', email);
      formData.append('phone', phone);
      formData.append('orderType', orderType);
      formData.append('totalAmount', getTotal());
      formData.append('paymentProof', paymentProof);

      if (orderType === 'delivery') {
        formData.append('deliveryStreet', deliveryStreet);
        formData.append('deliveryStreet2', deliveryStreet2);
        formData.append('deliveryCity', deliveryCity);
        formData.append('deliveryState', deliveryState);
        formData.append('deliveryZip', deliveryZip);
        formData.append('deliveryLandmark', deliveryLandmark);
      }

      // Add quantities
      Object.entries(quantities).forEach(([item, qty]) => {
        formData.append(`${item.replace(/_([a-z])/g, (g) => g[1].toUpperCase())}Qty`, qty);
      });
      formData.append('itemsJson', JSON.stringify(quantities));

      // Parse and attach bundle flavors string
      if (quantities.classic_bundle > 0) {
        const classicText = Object.entries(classicBundleChoices)
          .map(([idx, choices]) => `Pack #${parseInt(idx, 10) + 1}: [${choices.join(', ')}]`)
          .join(' | ');
        formData.append('classicBundleFlavours', classicText);
      }

      if (quantities.premium_bundle > 0) {
        const premiumText = Object.entries(premiumBundleChoices)
          .map(([idx, choices]) => `Pack #${parseInt(idx, 10) + 1}: [${choices.join(', ')}]`)
          .join(' | ');
        formData.append('premiumBundleFlavours', premiumText);
      }

      const res = await fetch('/api/preorder/submit', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessOrderId(data.orderId);
      } else {
        setErrorMsg(data.error || 'Failed to place preorder. Please try again.');
      }
    } catch (err) {
      setErrorMsg('A network error occurred. Please check your internet connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Success Screen
  if (successOrderId) {
    return (
      <div className={styles.container}>
        <div className={styles.inner}>
          <div className={styles.successCard}>
            <div className={styles.brandLogosWrapperSmall}>
              <img src="/esero-logo.jpg" alt="Cafe Esero Logo" className={styles.logoEseroSmall} />
              <span className={styles.logoBadgeXSmall}>✕</span>
              <img src="/crumble-logo.png" alt="Crumble Cookie Logo" className={styles.logoCrumbleSmall} />
            </div>
            <h1 className={styles.successTitle}>Preorder Placed!</h1>
            <p className={styles.successText}>
              Thank you, <strong>{firstName}</strong>! Your preorder has been successfully submitted for payment verification. A confirmation email has been sent to <strong>{email}</strong>.
            </p>
            <div className={styles.refBox}>
              <span className={styles.refLabel}>Preorder Reference Code</span>
              <span className={styles.refVal}>{successOrderId.substring(0, 8).toUpperCase()}</span>
            </div>
            
            {/* Instagram Delivery & Pickup Timings Box */}
            <div style={{ 
              backgroundColor: '#fdf0f5', 
              border: '1px solid #f8bbd0', 
              borderRadius: '12px', 
              padding: '20px', 
              margin: '25px 0', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              gap: '10px',
              boxShadow: '0 2px 8px rgba(216, 27, 96, 0.04)'
            }}>
              <span style={{ fontSize: '1.5rem' }}>📸</span>
              <p style={{ margin: 0, fontSize: '0.95rem', color: '#880e4f', textAlign: 'center', fontWeight: '600', lineHeight: '1.4' }}>
                Please visit our Instagram for delivery or pickup timings:
              </p>
              <a 
                href="https://www.instagram.com/esero.pk/" 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)', 
                  color: '#ffffff', 
                  padding: '10px 20px', 
                  borderRadius: '24px', 
                  fontSize: '0.9rem', 
                  fontWeight: 'bold', 
                  textDecoration: 'none',
                  boxShadow: '0 4px 10px rgba(220, 39, 67, 0.25)',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'scale(1.04)';
                  e.currentTarget.style.boxShadow = '0 6px 15px rgba(220, 39, 67, 0.35)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = '0 4px 10px rgba(220, 39, 67, 0.25)';
                }}
              >
                Visit @esero.pk
              </a>
            </div>

            <p style={{ fontSize: '0.9rem', color: '#8d6e63', marginBottom: '30px' }}>
              We will verify your bank transfer screenshot and email you a status update within a few hours.
            </p>
            <div className={styles.successActions}>
              <button
                className={styles.successBtn}
                onClick={() => window.location.reload()}
              >
                Place Another Preorder
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <div className={styles.brandLogosWrapper}>
            <div className={styles.logoBadgeContainer}>
              <img src="/esero-logo.jpg" alt="Cafe Esero Logo" className={styles.logoEsero} />
            </div>
            <span className={styles.logoBadgeX}>✕</span>
            <div className={styles.logoBadgeContainer}>
              <img src="/crumble-logo.png" alt="Crumble Cookie Logo" className={styles.logoCrumble} />
            </div>
          </div>
          <h1 className={styles.title}>Esero ✕ Crumble Cookie</h1>
          <p className={styles.subtitle}>
            Reserve your favourite Crumble cookies before they're sold out—limited stock available.
          </p>
          {activeBatchName && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              marginTop: '12px',
              padding: '6px 16px',
              background: 'rgba(200, 162, 122, 0.12)',
              border: '1px solid rgba(200, 162, 122, 0.3)',
              borderRadius: '20px',
              fontSize: '0.85rem',
              color: '#e6c8a2',
              fontWeight: '600'
            }}>
              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#81c784' }}></span>
              Now Booking: <strong style={{ color: '#ffffff' }}>{activeBatchName}</strong>
            </div>
          )}
        </header>

        {announcement && announcement.isActive && announcement.text && (
          <div 
            style={{
              background: 'linear-gradient(135deg, rgba(200, 162, 122, 0.15), rgba(141, 110, 99, 0.15))',
              border: '1px solid rgba(200, 162, 122, 0.3)',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '25px',
              boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)',
              backdropFilter: 'blur(4px)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span style={{ fontSize: '1.25rem' }}>📢</span>
              <h3 style={{ margin: 0, color: '#c8a27a', fontSize: '1rem', fontWeight: 'bold' }}>Cafe Esero Updates</h3>
            </div>
            <p style={{ margin: 0, color: '#d7ccc8', fontSize: '0.9rem', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
              {announcement.text}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.card} id="preorder-form">
          {/* Customer Information */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <span>👤</span> Customer Information
            </h2>
            <div className={styles.row}>
              <div className={styles.group}>
                <label className={styles.label}>
                  First Name<span className={styles.required}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First Name"
                  className={styles.input}
                  id="firstName"
                />
              </div>
              <div className={styles.group}>
                <label className={styles.label}>
                  Last Name<span className={styles.required}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last Name"
                  className={styles.input}
                  id="lastName"
                />
              </div>
            </div>

            <div className={styles.group}>
              <label className={styles.label}>
                Mobile / WhatsApp Number<span className={styles.required}>*</span>
              </label>
              <input
                type="text"
                required
                value={phone}
                onChange={handlePhoneChange}
                placeholder="(000) 000-00000"
                className={styles.input}
                id="phone"
              />
              <p style={{ margin: '3px 0 0 0', fontSize: '0.75rem', color: '#b3c4e6' }}>
                Format: (000) 000-00000.
              </p>
            </div>

            <div className={styles.group}>
              <label className={styles.label}>
                Email Address<span className={styles.required}>*</span>
              </label>
              <div className={styles.emailInputContainer}>
                <input
                  type="email"
                  required
                  disabled={emailVerified}
                  value={email}
                  onChange={handleEmailChange}
                  onBlur={() => checkEmailVerificationStatus(email)}
                  placeholder="name@example.com"
                  className={styles.input}
                  style={{ flex: 1 }}
                  id="email"
                />
                <button
                  type="button"
                  disabled={emailVerified || otpLoading || !email.includes('@')}
                  onClick={sendVerificationCode}
                  className={styles.verifyBtn}
                  id="verify-email-btn"
                >
                  {otpLoading && !otpSent ? 'Sending...' : 'Verify'}
                </button>
              </div>

              {otpError && (
                <p className={styles.errorMessage} style={{ marginTop: '5px' }}>
                  ⚠ {otpError}
                </p>
              )}

              {otpSent && !emailVerified && (
                <div className={styles.otpContainer}>
                  <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', fontWeight: 600, color: '#f5cf73' }}>
                    Enter the 6-digit OTP code sent to your email:
                  </p>
                  <div className={styles.otpRow}>
                    <input
                      type="text"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="123456"
                      className={styles.input}
                      style={{ letterSpacing: '4px', textAlign: 'center', width: '120px' }}
                      id="otpCode"
                    />
                    <button
                      type="button"
                      disabled={otpLoading || otpCode.length !== 6}
                      onClick={verifyCode}
                      className={styles.verifyBtn}
                      id="verify-code-btn"
                    >
                      {otpLoading ? 'Verifying...' : 'Submit OTP'}
                    </button>
                  </div>
                </div>
              )}

              {emailVerified && (
                <div className={styles.otpSuccessMessage} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <span>✓ {otpSuccess || 'Email verified. Form unlocked.'}</span>
                  <button
                    type="button"
                    onClick={() => { setEmailVerified(false); setOtpSuccess(''); setOtpSent(false); }}
                    style={{ background: 'none', border: 'none', color: '#ff8a80', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline', fontWeight: 'bold' }}
                  >
                    Change Email
                  </button>
                </div>
              )}
              {otpSuccess && !emailVerified && (
                <p style={{ fontSize: '0.8rem', color: '#69f0ae', margin: '5px 0 0 0' }}>{otpSuccess}</p>
              )}
            </div>
          </div>

          {/* Order Type */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <span>🛵</span> Order Type
            </h2>

            {!orderSettings.isPickupEnabled && !orderSettings.isDeliveryEnabled && (
              <div style={{
                backgroundColor: 'rgba(211, 47, 47, 0.25)',
                border: '1px solid #ff5252',
                borderRadius: '8px',
                padding: '12px 16px',
                color: '#ff8a80',
                fontSize: '0.85rem',
                fontWeight: 'bold',
                marginBottom: '15px',
                textAlign: 'center'
              }}>
                ⚠️ Online preorders are currently closed by admin for both Delivery and Pickup.
              </div>
            )}

            <div className={styles.typeContainer}>
              <div
                className={styles.typeCard}
                style={{ opacity: 0.6, cursor: 'not-allowed', borderColor: 'rgba(255, 255, 255, 0.1)', backgroundColor: 'rgba(10, 20, 38, 0.5)' }}
                title="Dine-in preorders can only be placed at the cafe counter."
                id="type-dine-in"
              >
                <span className={styles.typeIcon}>☕</span>
                <span className={styles.typeName} style={{ textDecoration: 'line-through', color: '#b3c4e6' }}>Dine-in</span>
                <span style={{ fontSize: '0.65rem', color: '#ff4081', fontWeight: 'bold', marginTop: '3px' }}>Counter Only</span>
              </div>

              {/* Takeaway / Pickup Card */}
              <div
                className={`${styles.typeCard} ${orderType === 'takeaway' && orderSettings.isPickupEnabled ? styles.typeCardActive : ''}`}
                style={!orderSettings.isPickupEnabled ? {
                  opacity: 0.5,
                  cursor: 'not-allowed',
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                  backgroundColor: 'rgba(10, 20, 38, 0.5)'
                } : {}}
                onClick={() => {
                  if (orderSettings.isPickupEnabled) {
                    setOrderType('takeaway');
                  } else {
                    alert('Pickup / Takeaway preorders are currently closed by admin.');
                  }
                }}
                id="type-takeaway"
              >
                <span className={styles.typeIcon}>🛍️</span>
                <span className={styles.typeName} style={!orderSettings.isPickupEnabled ? { textDecoration: 'line-through', color: '#b3c4e6' } : {}}>Takeaway</span>
                {!orderSettings.isPickupEnabled && (
                  <span style={{ fontSize: '0.65rem', color: '#ff5252', fontWeight: 'bold', marginTop: '3px' }}>Closed</span>
                )}
              </div>

              {/* Delivery Card */}
              <div
                className={`${styles.typeCard} ${orderType === 'delivery' && orderSettings.isDeliveryEnabled ? styles.typeCardActive : ''}`}
                style={!orderSettings.isDeliveryEnabled ? {
                  opacity: 0.5,
                  cursor: 'not-allowed',
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                  backgroundColor: 'rgba(10, 20, 38, 0.5)'
                } : {}}
                onClick={() => {
                  if (orderSettings.isDeliveryEnabled) {
                    setOrderType('delivery');
                  } else {
                    alert('Delivery preorders are currently closed by admin.');
                  }
                }}
                id="type-delivery"
              >
                <span className={styles.typeIcon}>🚚</span>
                <span className={styles.typeName} style={!orderSettings.isDeliveryEnabled ? { textDecoration: 'line-through', color: '#b3c4e6' } : {}}>Delivery</span>
                {!orderSettings.isDeliveryEnabled && (
                  <span style={{ fontSize: '0.65rem', color: '#ff5252', fontWeight: 'bold', marginTop: '3px' }}>Closed</span>
                )}
              </div>
            </div>

            <p style={{ margin: '12px 0 0 0', fontSize: '0.8rem', color: '#b3c4e6', fontStyle: 'italic' }}>
              ℹ Dine-in orders can only be placed directly at the cafe counter. Online preorders are restricted to Takeaway and Delivery (standard delivery fee is PKR 300).
            </p>

            {orderType === 'delivery' && (
              <div style={{ marginTop: '25px', animation: 'slideDown 0.4s ease' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 15px 0', color: '#f5cf73' }}>
                  Complete Delivery Address
                </h3>
                <div className={styles.group}>
                  <label className={styles.label}>
                    Street Address<span className={styles.required}>*</span>
                  </label>
                  <input
                    type="text"
                    required={orderType === 'delivery'}
                    value={deliveryStreet}
                    onChange={(e) => setDeliveryStreet(e.target.value)}
                    placeholder="Street name and house number"
                    className={styles.input}
                    id="deliveryStreet"
                  />
                </div>
                <div className={styles.group}>
                  <label className={styles.label}>Street Address Line 2</label>
                  <input
                    type="text"
                    value={deliveryStreet2}
                    onChange={(e) => setDeliveryStreet2(e.target.value)}
                    placeholder="Apartment, suite, unit, building, floor, etc. (optional)"
                    className={styles.input}
                    id="deliveryStreet2"
                  />
                </div>
                <div className={styles.row}>
                  <div className={styles.group}>
                    <label className={styles.label}>
                      City<span className={styles.required}>*</span>
                    </label>
                    <input
                      type="text"
                      required={orderType === 'delivery'}
                      value={deliveryCity}
                      onChange={(e) => setDeliveryCity(e.target.value)}
                      placeholder="City"
                      className={styles.input}
                      id="deliveryCity"
                    />
                  </div>
                  <div className={styles.group}>
                    <label className={styles.label}>
                      State / Province<span className={styles.required}>*</span>
                    </label>
                    <input
                      type="text"
                      required={orderType === 'delivery'}
                      value={deliveryState}
                      onChange={(e) => setDeliveryState(e.target.value)}
                      placeholder="State / Province"
                      className={styles.input}
                      id="deliveryState"
                    />
                  </div>
                </div>
                <div className={styles.row}>
                  <div className={styles.group}>
                    <label className={styles.label}>Postal / Zip Code</label>
                    <input
                      type="text"
                      value={deliveryZip}
                      onChange={(e) => setDeliveryZip(e.target.value)}
                      placeholder="Postal / Zip Code"
                      className={styles.input}
                      id="deliveryZip"
                    />
                  </div>
                  <div className={styles.group}>
                    <label className={styles.label}>Landmark</label>
                    <input
                      type="text"
                      value={deliveryLandmark}
                      onChange={(e) => setDeliveryLandmark(e.target.value)}
                      placeholder="Famous place nearby (optional)"
                      className={styles.input}
                      id="deliveryLandmark"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Cookie Menu */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <span>🍪</span> Cookie Menu
            </h2>
            <div className={styles.menuGrid}>
              {(menuItems.length > 0
                ? menuItems.filter((i) => i.is_active !== false && i.key !== 'classic_bundle' && i.key !== 'premium_bundle')
                : [
                    { key: 'classic_chocolate_chip', name: 'Classic Chocolate Chip', price: 580 },
                    { key: 'double_chocolate', name: 'Double Chocolate', price: 580 },
                    { key: 'chocolate_chip_walnut', name: 'Chocolate Chip Walnut', price: 580 },
                    { key: 'cookies_cream', name: 'Cookies & Cream', price: 620 },
                    { key: 'kunafa_chocolate', name: 'Kunafa Chocolate', price: 620 },
                    { key: 'hazelnut_filled', name: 'Hazelnut Filled', price: 620 },
                    { key: 'lotus_lava', name: 'Lotus Lava', price: 620 },
                  ]
              ).map((item) => {
                const soldOut = isSoldOut(item.key);
                const stockVal = stockStatus[item.key]?.available ?? item.available ?? 0;
                const currentPrice = getItemPrice(item.key);
                return (
                  <div key={item.key} className={`${styles.menuItem} ${soldOut ? styles.menuItemSoldOut : ''}`}>
                    <div className={styles.cookieInfo}>
                      <span className={styles.cookieName}>{item.name}</span>
                      <span className={styles.cookiePrice}>PKR {currentPrice} each</span>
                      {stockStatus[item.key] && (
                        <span style={{ fontSize: '0.8rem', color: soldOut ? '#ff5252' : '#b3c4e6', fontWeight: 600 }}>
                          {soldOut ? 'Sold Out' : `${stockVal} remaining`}
                        </span>
                      )}
                      {soldOut && <span className={styles.soldOutBadge}>SOLD OUT</span>}
                    </div>
                    <div className={styles.counter}>
                      <button
                        type="button"
                        disabled={(quantities[item.key] || 0) === 0}
                        onClick={() => adjustQuantity(item.key, -1)}
                        className={styles.counterBtn}
                      >
                        -
                      </button>
                      <span className={styles.counterVal}>{quantities[item.key] || 0}</span>
                      <button
                        type="button"
                        disabled={soldOut}
                        onClick={() => adjustQuantity(item.key, 1)}
                        className={styles.counterBtn}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Item: Classic Bundle */}
              {stockStatus.classic_bundle?.is_active !== false && (
                <div className={`${styles.menuItem} ${isSoldOut('classic_bundle') ? styles.menuItemSoldOut : ''}`}>
                  <div className={styles.cookieInfo}>
                    <span className={styles.cookieName}>Classic Bundle (pack of 4)</span>
                    <span className={styles.cookiePrice}>PKR {getItemPrice('classic_bundle')}</span>
                    <span style={{ fontSize: '0.8rem', color: '#b3c4e6' }}>Select 4 classic flavours below</span>
                    {isSoldOut('classic_bundle') && <span className={styles.soldOutBadge}>SOLD OUT</span>}
                  </div>
                  <div className={styles.counter}>
                    <button
                      type="button"
                      disabled={(quantities.classic_bundle || 0) === 0}
                      onClick={() => adjustQuantity('classic_bundle', -1)}
                      className={styles.counterBtn}
                    >
                      -
                    </button>
                    <span className={styles.counterVal}>{quantities.classic_bundle || 0}</span>
                    <button
                      type="button"
                      disabled={isSoldOut('classic_bundle')}
                      onClick={() => adjustQuantity('classic_bundle', 1)}
                      className={styles.counterBtn}
                    >
                      +
                    </button>
                  </div>

                  {quantities.classic_bundle > 0 && (
                    <div className={styles.bundleDetails}>
                      <p className={styles.bundleHeading}>Select Classic Bundle Flavours</p>
                      {Array.from({ length: quantities.classic_bundle }).map((_, bIdx) => {
                        const dynamicClassic = menuItems.filter((i) => (i.category === 'classic' || i.key.startsWith('classic') || i.key === 'chocolate_chip_walnut') && i.is_active !== false).map((i) => i.name);
                        const classicOptions = dynamicClassic.length > 0 ? dynamicClassic : CLASSIC_FLAVORS;
                        return (
                          <div key={bIdx} style={{ marginBottom: '12px' }}>
                            <p style={{ fontSize: '0.8rem', fontWeight: 'bold', margin: '0 0 5px 0', color: '#f5cf73' }}>
                              Pack #{bIdx + 1}
                            </p>
                            <div className={styles.bundleGrid}>
                              {Array.from({ length: 4 }).map((_, cIdx) => (
                                <div key={cIdx} className={styles.bundleSelectGroup}>
                                  <span className={styles.bundleSelectLabel}>Cookie {cIdx + 1}</span>
                                  <select
                                    className={styles.select}
                                    value={classicBundleChoices[bIdx]?.[cIdx] || classicOptions[0]}
                                    onChange={(e) => updateBundleFlavor('classic', bIdx, cIdx, e.target.value)}
                                  >
                                    {classicOptions.map((f) => (
                                      <option key={f} value={f}>
                                        {f}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Item: Premium Bundle */}
              {stockStatus.premium_bundle?.is_active !== false && (
                <div className={`${styles.menuItem} ${isSoldOut('premium_bundle') ? styles.menuItemSoldOut : ''}`}>
                  <div className={styles.cookieInfo}>
                    <span className={styles.cookieName}>Premium Bundle (pack of 4)</span>
                    <span className={styles.cookiePrice}>PKR {getItemPrice('premium_bundle')}</span>
                    <span style={{ fontSize: '0.8rem', color: '#b3c4e6' }}>Select 4 premium flavours below</span>
                    {isSoldOut('premium_bundle') && <span className={styles.soldOutBadge}>SOLD OUT</span>}
                  </div>
                  <div className={styles.counter}>
                    <button
                      type="button"
                      disabled={(quantities.premium_bundle || 0) === 0}
                      onClick={() => adjustQuantity('premium_bundle', -1)}
                      className={styles.counterBtn}
                    >
                      -
                    </button>
                    <span className={styles.counterVal}>{quantities.premium_bundle || 0}</span>
                    <button
                      type="button"
                      disabled={isSoldOut('premium_bundle')}
                      onClick={() => adjustQuantity('premium_bundle', 1)}
                      className={styles.counterBtn}
                    >
                      +
                    </button>
                  </div>

                  {quantities.premium_bundle > 0 && (
                    <div className={styles.bundleDetails}>
                      <p className={styles.bundleHeading}>Select Premium Bundle Flavours</p>
                      {Array.from({ length: quantities.premium_bundle }).map((_, bIdx) => {
                        const dynamicPremium = menuItems.filter((i) => (i.category === 'premium' || (!i.key.startsWith('classic') && i.key !== 'chocolate_chip_walnut')) && i.is_active !== false).map((i) => i.name);
                        const premiumOptions = dynamicPremium.length > 0 ? dynamicPremium : PREMIUM_FLAVORS;
                        return (
                          <div key={bIdx} style={{ marginBottom: '12px' }}>
                            <p style={{ fontSize: '0.8rem', fontWeight: 'bold', margin: '0 0 5px 0', color: '#f5cf73' }}>
                              Pack #{bIdx + 1}
                            </p>
                            <div className={styles.bundleGrid}>
                              {Array.from({ length: 4 }).map((_, cIdx) => (
                                <div key={cIdx} className={styles.bundleSelectGroup}>
                                  <span className={styles.bundleSelectLabel}>Cookie {cIdx + 1}</span>
                                  <select
                                    className={styles.select}
                                    value={premiumBundleChoices[bIdx]?.[cIdx] || premiumOptions[0]}
                                    onChange={(e) => updateBundleFlavor('premium', bIdx, cIdx, e.target.value)}
                                  >
                                    {premiumOptions.map((f) => (
                                      <option key={f} value={f}>
                                        {f}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Payment Details */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <span>💳</span> Payment Instructions
            </h2>
            <p style={{ fontSize: '0.9rem', margin: '0 0 15px 0', color: '#b3c4e6', lineHeight: '1.5' }}>
              Please transfer the exact preorder amount to the bank account below. Copy the details easily by clicking the buttons.
            </p>

            <div className={styles.paymentBox}>
              <div className={styles.bankRow}>
                <span className={styles.bankLabel}>Bank Name</span>
                <span className={styles.bankValue}>MEEZAN BANK</span>
              </div>
              <div className={styles.bankRow}>
                <span className={styles.bankLabel}>Account Title</span>
                <span className={styles.bankValue}>ANASHA SHAKEEL</span>
              </div>
              <div className={styles.bankRow}>
                <span className={styles.bankLabel}>Account Number</span>
                <span className={styles.bankValue}>
                  99500109179059
                  <button
                    type="button"
                    onClick={() => handleCopy('99500109179059', 'acc')}
                    className={`${styles.copyBtn} ${copiedField === 'acc' ? styles.copyBtnSuccess : ''}`}
                  >
                    {copiedField === 'acc' ? 'Copied!' : 'Copy'}
                  </button>
                </span>
              </div>
              <div className={styles.bankRow}>
                <span className={styles.bankLabel}>IBAN</span>
                <span className={styles.bankValue} style={{ fontSize: '0.85rem' }}>
                  PK36MEZN0099500109179059
                  <button
                    type="button"
                    onClick={() => handleCopy('PK36MEZN0099500109179059', 'iban')}
                    className={`${styles.copyBtn} ${copiedField === 'iban' ? styles.copyBtnSuccess : ''}`}
                  >
                    {copiedField === 'iban' ? 'Copied!' : 'Copy'}
                  </button>
                </span>
              </div>
            </div>

            <p style={{ fontSize: '0.9rem', fontWeight: 'bold', margin: '0 0 10px 0', color: '#ffffff' }}>
              Note: Please transfer the exact order amount and upload your payment proof below.*
            </p>

            {/* Drag & Drop File Upload */}
            <div
              className={`${styles.uploadArea} ${dragOver ? styles.uploadAreaHover : ''} ${paymentProof ? styles.uploadAreaHasFile : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current.click()}
              id="payment-proof-upload-area"
            >
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileSelect}
                accept=".jpg,.jpeg,.png,.webp,.pdf"
              />
              <span className={styles.uploadIcon}>{paymentProof ? '📄' : '📁'}</span>
              <span className={styles.uploadText}>
                {paymentProof ? 'Change Uploaded Proof File' : 'Upload Payment Proof'}
              </span>
              <span className={styles.uploadSubtext}>
                Drag & drop your transaction screenshot/receipt here, or click to browse.
              </span>
              <span className={styles.uploadSubtext} style={{ fontSize: '0.7rem', display: 'block', marginTop: '5px' }}>
                Supported Formats: JPG, PNG, WEBP, PDF (Max Size: 2MB)
              </span>

              {paymentProof && (
                <div className={styles.uploadPreview} onClick={(e) => e.stopPropagation()}>
                  {paymentProof.type.startsWith('image/') && (
                    <img
                      src={URL.createObjectURL(paymentProof)}
                      alt="Payment proof thumb"
                      className={styles.previewThumb}
                    />
                  )}
                  <div className={styles.fileMeta}>
                    <p className={styles.fileName}>{paymentProof.name}</p>
                    <p className={styles.fileSize}>{(paymentProof.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className={styles.removeFileBtn}
                  >
                    &times;
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Totals Summary */}
          <div className={styles.summaryBox}>
            {/* Selected Items Breakdown */}
            {totalItems > 0 && (
              <div style={{ marginBottom: '15px', borderBottom: '1px dashed rgba(226, 174, 70, 0.3)', paddingBottom: '10px' }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', fontWeight: 700, color: '#f5cf73' }}>
                  Selected Cookies Breakdown:
                </p>
                {Object.entries(quantities).map(([item, qty]) => {
                  if (qty <= 0) return null;
                  
                  // Make human-friendly name
                  const displayName =
                    stockStatus[item]?.flavor_name ||
                    stockStatus[item]?.name ||
                    item
                      .split('_')
                      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                      .join(' ')
                      .replace('Cookies Cream', 'Cookies & Cream')
                      .replace('Classic Bundle', 'Classic Bundle (Pack of 4)')
                      .replace('Premium Bundle', 'Premium Bundle (Pack of 4)');

                  const itemTotal = qty * getItemPrice(item);
                  return (
                    <div key={item} className={styles.summaryRow} style={{ fontSize: '0.85rem', color: '#d1ddf7', margin: '3px 0' }}>
                      <span>
                        • {displayName} <strong style={{ color: '#ffffff' }}>x{qty}</strong>
                      </span>
                      <span>PKR {itemTotal.toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className={styles.summaryRow}>
              <span>Subtotal ({totalItems} cookies)</span>
              <span>PKR {getSubtotal().toLocaleString()}</span>
            </div>
            <div className={styles.summaryRow}>
              <span>Delivery Fee</span>
              <span>PKR {getDeliveryFee().toLocaleString()}</span>
            </div>
            <div className={styles.summaryTotal}>
              <span>Total Amount</span>
              <span>PKR {getTotal().toLocaleString()}</span>
            </div>
          </div>

          {errorMsg && (
            <p className={styles.errorMessage} style={{ marginBottom: '20px', fontSize: '0.9rem', fontWeight: 600 }}>
              ⚠ {errorMsg}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !emailVerified || totalItems === 0 || !paymentProof}
            className={styles.submitBtn}
            id="place-preorder-btn"
          >
            {loading ? 'Processing Preorder...' : 'Place Preorder'}
          </button>
        </form>
      </div>
    </div>
  );
}
