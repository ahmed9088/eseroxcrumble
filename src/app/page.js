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
  const [orderType, setOrderType] = useState('dine_in'); // 'dine_in', 'takeaway', 'delivery'

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

  // Fetch Stock Status on Mount
  useEffect(() => {
    async function loadStock() {
      try {
        const res = await fetch('/api/admin/stock');
        const data = await res.json();
        if (data.stock) {
          setStockStatus(data.stock);
        }
      } catch (err) {
        console.error('Failed to load stock settings', err);
      }
    }
    loadStock();
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

  // Quantity Change Handlers
  const adjustQuantity = (item, diff) => {
    if (!stockStatus[item] && diff > 0) return; // Prevent ordering sold-out
    setQuantities((prev) => {
      const newVal = Math.max(0, prev[item] + diff);
      return { ...prev, [item]: newVal };
    });
  };

  // Totals Calculations
  const getSubtotal = () => {
    return Object.entries(quantities).reduce((acc, [item, qty]) => {
      return acc + qty * COOKIE_PRICES[item];
    }, 0);
  };

  const getDeliveryFee = () => {
    return orderType === 'delivery' ? 250 : 0; // Flat delivery fee
  };

  const getTotal = () => {
    return getSubtotal() + getDeliveryFee();
  };

  const totalItems = Object.values(quantities).reduce((a, b) => a + b, 0);

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
        setOtpSent(true);
        const successMsg = data.devHint 
          ? `Verification code sent. ${data.devHint}`
          : 'Verification code sent to your email.';
        setOtpSuccess(successMsg);
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
            <span className={styles.successIcon}>🍪</span>
            <h1 className={styles.successTitle}>Preorder Placed!</h1>
            <p className={styles.successText}>
              Thank you, <strong>{firstName}</strong>! Your preorder has been successfully submitted for payment verification. A confirmation email has been sent to <strong>{email}</strong>.
            </p>
            <div className={styles.refBox}>
              <span className={styles.refLabel}>Preorder Reference Code</span>
              <span className={styles.refVal}>{successOrderId.substring(0, 8).toUpperCase()}</span>
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
          <span className={styles.badge}>Cafe Esero</span>
          <h1 className={styles.title}>🍪 Esero × Crumble Cookie Preorder</h1>
          <p className={styles.subtitle}>
            Reserve your favourite Crumble cookies before they're sold out—limited stock available.
          </p>
        </header>

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
              <p style={{ margin: '3px 0 0 0', fontSize: '0.75rem', color: '#8d6e63' }}>
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
                  onChange={(e) => setEmail(e.target.value)}
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
                  <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', fontWeight: 600, color: '#5d4037' }}>
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
                <div className={styles.otpSuccessMessage}>
                  <span>✓</span> Email verified successfully. Form unlocked.
                </div>
              )}
              {otpSuccess && !emailVerified && (
                <p style={{ fontSize: '0.8rem', color: '#2e7d32', margin: '5px 0 0 0' }}>{otpSuccess}</p>
              )}
            </div>
          </div>

          {/* Order Type */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <span>🛵</span> Order Type
            </h2>
            <div className={styles.typeContainer}>
              <div
                className={`${styles.typeCard} ${orderType === 'dine_in' ? styles.typeCardActive : ''}`}
                onClick={() => setOrderType('dine_in')}
                id="type-dine-in"
              >
                <span className={styles.typeIcon}>☕</span>
                <span className={styles.typeName}>Dine-in</span>
              </div>
              <div
                className={`${styles.typeCard} ${orderType === 'takeaway' ? styles.typeCardActive : ''}`}
                onClick={() => setOrderType('takeaway')}
                id="type-takeaway"
              >
                <span className={styles.typeIcon}>🛍️</span>
                <span className={styles.typeName}>Takeaway</span>
              </div>
              <div
                className={`${styles.typeCard} ${orderType === 'delivery' ? styles.typeCardActive : ''}`}
                onClick={() => setOrderType('delivery')}
                id="type-delivery"
              >
                <span className={styles.typeIcon}>🚚</span>
                <span className={styles.typeName}>Delivery</span>
              </div>
            </div>

            {orderType === 'delivery' && (
              <div style={{ marginTop: '25px', animation: 'slideDown 0.4s ease' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 15px 0', color: '#5d4037' }}>
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
              {/* Item 1: Classic Chocolate Chip */}
              <div className={`${styles.menuItem} ${!stockStatus.classic_chocolate_chip ? styles.menuItemSoldOut : ''}`}>
                <div className={styles.cookieInfo}>
                  <span className={styles.cookieName}>Classic Chocolate Chip</span>
                  <span className={styles.cookiePrice}>PKR 580 each</span>
                  {!stockStatus.classic_chocolate_chip && <span className={styles.soldOutBadge}>SOLD OUT</span>}
                </div>
                <div className={styles.counter}>
                  <button
                    type="button"
                    disabled={quantities.classic_chocolate_chip === 0}
                    onClick={() => adjustQuantity('classic_chocolate_chip', -1)}
                    className={styles.counterBtn}
                  >
                    -
                  </button>
                  <span className={styles.counterVal}>{quantities.classic_chocolate_chip}</span>
                  <button
                    type="button"
                    disabled={!stockStatus.classic_chocolate_chip}
                    onClick={() => adjustQuantity('classic_chocolate_chip', 1)}
                    className={styles.counterBtn}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Item 2: Double Chocolate */}
              <div className={`${styles.menuItem} ${!stockStatus.double_chocolate ? styles.menuItemSoldOut : ''}`}>
                <div className={styles.cookieInfo}>
                  <span className={styles.cookieName}>Double Chocolate</span>
                  <span className={styles.cookiePrice}>PKR 580 each</span>
                  {!stockStatus.double_chocolate && <span className={styles.soldOutBadge}>SOLD OUT</span>}
                </div>
                <div className={styles.counter}>
                  <button
                    type="button"
                    disabled={quantities.double_chocolate === 0}
                    onClick={() => adjustQuantity('double_chocolate', -1)}
                    className={styles.counterBtn}
                  >
                    -
                  </button>
                  <span className={styles.counterVal}>{quantities.double_chocolate}</span>
                  <button
                    type="button"
                    disabled={!stockStatus.double_chocolate}
                    onClick={() => adjustQuantity('double_chocolate', 1)}
                    className={styles.counterBtn}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Item 3: Chocolate Chip Walnut */}
              <div className={`${styles.menuItem} ${!stockStatus.chocolate_chip_walnut ? styles.menuItemSoldOut : ''}`}>
                <div className={styles.cookieInfo}>
                  <span className={styles.cookieName}>Chocolate Chip Walnut</span>
                  <span className={styles.cookiePrice}>PKR 580 each</span>
                  {!stockStatus.chocolate_chip_walnut && <span className={styles.soldOutBadge}>SOLD OUT</span>}
                </div>
                <div className={styles.counter}>
                  <button
                    type="button"
                    disabled={quantities.chocolate_chip_walnut === 0}
                    onClick={() => adjustQuantity('chocolate_chip_walnut', -1)}
                    className={styles.counterBtn}
                  >
                    -
                  </button>
                  <span className={styles.counterVal}>{quantities.chocolate_chip_walnut}</span>
                  <button
                    type="button"
                    disabled={!stockStatus.chocolate_chip_walnut}
                    onClick={() => adjustQuantity('chocolate_chip_walnut', 1)}
                    className={styles.counterBtn}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Item 4: Cookies & Cream */}
              <div className={`${styles.menuItem} ${!stockStatus.cookies_cream ? styles.menuItemSoldOut : ''}`}>
                <div className={styles.cookieInfo}>
                  <span className={styles.cookieName}>Cookies & Cream</span>
                  <span className={styles.cookiePrice}>PKR 620 each</span>
                  {!stockStatus.cookies_cream && <span className={styles.soldOutBadge}>SOLD OUT</span>}
                </div>
                <div className={styles.counter}>
                  <button
                    type="button"
                    disabled={quantities.cookies_cream === 0}
                    onClick={() => adjustQuantity('cookies_cream', -1)}
                    className={styles.counterBtn}
                  >
                    -
                  </button>
                  <span className={styles.counterVal}>{quantities.cookies_cream}</span>
                  <button
                    type="button"
                    disabled={!stockStatus.cookies_cream}
                    onClick={() => adjustQuantity('cookies_cream', 1)}
                    className={styles.counterBtn}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Item 5: Kunafa Chocolate */}
              <div className={`${styles.menuItem} ${!stockStatus.kunafa_chocolate ? styles.menuItemSoldOut : ''}`}>
                <div className={styles.cookieInfo}>
                  <span className={styles.cookieName}>Kunafa Chocolate</span>
                  <span className={styles.cookiePrice}>PKR 620 each</span>
                  {!stockStatus.kunafa_chocolate && <span className={styles.soldOutBadge}>SOLD OUT</span>}
                </div>
                <div className={styles.counter}>
                  <button
                    type="button"
                    disabled={quantities.kunafa_chocolate === 0}
                    onClick={() => adjustQuantity('kunafa_chocolate', -1)}
                    className={styles.counterBtn}
                  >
                    -
                  </button>
                  <span className={styles.counterVal}>{quantities.kunafa_chocolate}</span>
                  <button
                    type="button"
                    disabled={!stockStatus.kunafa_chocolate}
                    onClick={() => adjustQuantity('kunafa_chocolate', 1)}
                    className={styles.counterBtn}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Item 6: Hazelnut Filled */}
              <div className={`${styles.menuItem} ${!stockStatus.hazelnut_filled ? styles.menuItemSoldOut : ''}`}>
                <div className={styles.cookieInfo}>
                  <span className={styles.cookieName}>Hazelnut Filled</span>
                  <span className={styles.cookiePrice}>PKR 620 each</span>
                  {!stockStatus.hazelnut_filled && <span className={styles.soldOutBadge}>SOLD OUT</span>}
                </div>
                <div className={styles.counter}>
                  <button
                    type="button"
                    disabled={quantities.hazelnut_filled === 0}
                    onClick={() => adjustQuantity('hazelnut_filled', -1)}
                    className={styles.counterBtn}
                  >
                    -
                  </button>
                  <span className={styles.counterVal}>{quantities.hazelnut_filled}</span>
                  <button
                    type="button"
                    disabled={!stockStatus.hazelnut_filled}
                    onClick={() => adjustQuantity('hazelnut_filled', 1)}
                    className={styles.counterBtn}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Item 7: Lotus Lava */}
              <div className={`${styles.menuItem} ${!stockStatus.lotus_lava ? styles.menuItemSoldOut : ''}`}>
                <div className={styles.cookieInfo}>
                  <span className={styles.cookieName}>Lotus Lava</span>
                  <span className={styles.cookiePrice}>PKR 620 each</span>
                  {!stockStatus.lotus_lava && <span className={styles.soldOutBadge}>SOLD OUT</span>}
                </div>
                <div className={styles.counter}>
                  <button
                    type="button"
                    disabled={quantities.lotus_lava === 0}
                    onClick={() => adjustQuantity('lotus_lava', -1)}
                    className={styles.counterBtn}
                  >
                    -
                  </button>
                  <span className={styles.counterVal}>{quantities.lotus_lava}</span>
                  <button
                    type="button"
                    disabled={!stockStatus.lotus_lava}
                    onClick={() => adjustQuantity('lotus_lava', 1)}
                    className={styles.counterBtn}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Item 8: Classic Bundle */}
              <div className={`${styles.menuItem} ${!stockStatus.classic_bundle ? styles.menuItemSoldOut : ''}`}>
                <div className={styles.cookieInfo}>
                  <span className={styles.cookieName}>Classic Bundle (pack of 4)</span>
                  <span className={styles.cookiePrice}>PKR 2,200</span>
                  <span style={{ fontSize: '0.8rem', color: '#8d6e63' }}>Select 4 classic flavours below</span>
                  {!stockStatus.classic_bundle && <span className={styles.soldOutBadge}>SOLD OUT</span>}
                </div>
                <div className={styles.counter}>
                  <button
                    type="button"
                    disabled={quantities.classic_bundle === 0}
                    onClick={() => adjustQuantity('classic_bundle', -1)}
                    className={styles.counterBtn}
                  >
                    -
                  </button>
                  <span className={styles.counterVal}>{quantities.classic_bundle}</span>
                  <button
                    type="button"
                    disabled={!stockStatus.classic_bundle}
                    onClick={() => adjustQuantity('classic_bundle', 1)}
                    className={styles.counterBtn}
                  >
                    +
                  </button>
                </div>

                {quantities.classic_bundle > 0 && (
                  <div className={styles.bundleDetails}>
                    <p className={styles.bundleHeading}>Select Classic Bundle Flavours</p>
                    {Array.from({ length: quantities.classic_bundle }).map((_, bIdx) => (
                      <div key={bIdx} style={{ marginBottom: '12px' }}>
                        <p style={{ fontSize: '0.8rem', fontWeight: 'bold', margin: '0 0 5px 0', color: '#8d6e63' }}>
                          Pack #{bIdx + 1}
                        </p>
                        <div className={styles.bundleGrid}>
                          {Array.from({ length: 4 }).map((_, cIdx) => (
                            <div key={cIdx} className={styles.bundleSelectGroup}>
                              <span className={styles.bundleSelectLabel}>Cookie {cIdx + 1}</span>
                              <select
                                className={styles.select}
                                value={classicBundleChoices[bIdx]?.[cIdx] || CLASSIC_FLAVORS[0]}
                                onChange={(e) => updateBundleFlavor('classic', bIdx, cIdx, e.target.value)}
                              >
                                {CLASSIC_FLAVORS.map((f) => (
                                  <option key={f} value={f}>
                                    {f}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Item 9: Premium Bundle */}
              <div className={`${styles.menuItem} ${!stockStatus.premium_bundle ? styles.menuItemSoldOut : ''}`}>
                <div className={styles.cookieInfo}>
                  <span className={styles.cookieName}>Premium Bundle (pack of 4)</span>
                  <span className={styles.cookiePrice}>PKR 2,400</span>
                  <span style={{ fontSize: '0.8rem', color: '#8d6e63' }}>Select 4 premium flavours below</span>
                  {!stockStatus.premium_bundle && <span className={styles.soldOutBadge}>SOLD OUT</span>}
                </div>
                <div className={styles.counter}>
                  <button
                    type="button"
                    disabled={quantities.premium_bundle === 0}
                    onClick={() => adjustQuantity('premium_bundle', -1)}
                    className={styles.counterBtn}
                  >
                    -
                  </button>
                  <span className={styles.counterVal}>{quantities.premium_bundle}</span>
                  <button
                    type="button"
                    disabled={!stockStatus.premium_bundle}
                    onClick={() => adjustQuantity('premium_bundle', 1)}
                    className={styles.counterBtn}
                  >
                    +
                  </button>
                </div>

                {quantities.premium_bundle > 0 && (
                  <div className={styles.bundleDetails}>
                    <p className={styles.bundleHeading}>Select Premium Bundle Flavours</p>
                    {Array.from({ length: quantities.premium_bundle }).map((_, bIdx) => (
                      <div key={bIdx} style={{ marginBottom: '12px' }}>
                        <p style={{ fontSize: '0.8rem', fontWeight: 'bold', margin: '0 0 5px 0', color: '#8d6e63' }}>
                          Pack #{bIdx + 1}
                        </p>
                        <div className={styles.bundleGrid}>
                          {Array.from({ length: 4 }).map((_, cIdx) => (
                            <div key={cIdx} className={styles.bundleSelectGroup}>
                              <span className={styles.bundleSelectLabel}>Cookie {cIdx + 1}</span>
                              <select
                                className={styles.select}
                                value={premiumBundleChoices[bIdx]?.[cIdx] || PREMIUM_FLAVORS[0]}
                                onChange={(e) => updateBundleFlavor('premium', bIdx, cIdx, e.target.value)}
                              >
                                {PREMIUM_FLAVORS.map((f) => (
                                  <option key={f} value={f}>
                                    {f}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Payment Details */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <span>💳</span> Payment Instructions
            </h2>
            <p style={{ fontSize: '0.9rem', margin: '0 0 15px 0', color: '#5d4037', lineHeight: '1.5' }}>
              Please transfer the exact preorder amount to the bank account below. Copy the details easily by clicking the buttons.
            </p>

            <div className={styles.paymentBox}>
              <div className={styles.bankRow}>
                <span className={styles.bankLabel}>Bank Name</span>
                <span className={styles.bankValue}>United Bank Limited</span>
              </div>
              <div className={styles.bankRow}>
                <span className={styles.bankLabel}>Account Title</span>
                <span className={styles.bankValue}>Shahrez Naeem Memon</span>
              </div>
              <div className={styles.bankRow}>
                <span className={styles.bankLabel}>Account Number</span>
                <span className={styles.bankValue}>
                  1284358920124
                  <button
                    type="button"
                    onClick={() => handleCopy('1284358920124', 'acc')}
                    className={`${styles.copyBtn} ${copiedField === 'acc' ? styles.copyBtnSuccess : ''}`}
                  >
                    {copiedField === 'acc' ? 'Copied!' : 'Copy'}
                  </button>
                </span>
              </div>
              <div className={styles.bankRow}>
                <span className={styles.bankLabel}>IBAN</span>
                <span className={styles.bankValue} style={{ fontSize: '0.85rem' }}>
                  PK09UNIL0109000358920124
                  <button
                    type="button"
                    onClick={() => handleCopy('PK09UNIL0109000358920124', 'iban')}
                    className={`${styles.copyBtn} ${copiedField === 'iban' ? styles.copyBtnSuccess : ''}`}
                  >
                    {copiedField === 'iban' ? 'Copied!' : 'Copy'}
                  </button>
                </span>
              </div>
            </div>

            <p style={{ fontSize: '0.9rem', fontWeight: 'bold', margin: '0 0 10px 0', color: '#3e2723' }}>
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
              <div style={{ marginBottom: '15px', borderBottom: '1px dashed #e6d3c0', paddingBottom: '10px' }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', fontWeight: 700, color: '#5d4037' }}>
                  Selected Cookies Breakdown:
                </p>
                {Object.entries(quantities).map(([item, qty]) => {
                  if (qty <= 0) return null;
                  
                  // Make human-friendly name
                  const displayName = item
                    .split('_')
                    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ')
                    .replace('Cookies Cream', 'Cookies & Cream')
                    .replace('Classic Bundle', 'Classic Bundle (Pack of 4)')
                    .replace('Premium Bundle', 'Premium Bundle (Pack of 4)');

                  const itemTotal = qty * COOKIE_PRICES[item];
                  return (
                    <div key={item} className={styles.summaryRow} style={{ fontSize: '0.85rem', color: '#6d4c41', margin: '3px 0' }}>
                      <span>
                        • {displayName} <strong style={{ color: '#3e2723' }}>x{qty}</strong>
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
