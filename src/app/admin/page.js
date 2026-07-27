'use client';

import { useState, useEffect } from 'react';
import styles from './admin.module.css';

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [passcode, setPasscode] = useState('');
  const [loginError, setLoginError] = useState('');

  // Dashboard Data
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [stock, setStock] = useState({
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

  // Filters and search
  const [search, setSearch] = useState('');
  const [filterPayment, setFilterPayment] = useState('');
  const [filterType, setFilterType] = useState('');

  // Selected Order for Detail Modal
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [zoomedImg, setZoomedImg] = useState(null);

  // Check Authentication Status on mount
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/admin/auth');
        const data = await res.json();
        if (data.authenticated) {
          setAuthenticated(true);
          loadDashboardData();
        }
      } catch (err) {
        console.error('Failed to check auth status', err);
      } finally {
        setAuthLoading(false);
      }
    }
    checkAuth();
  }, []);

  // Fetch orders and stock
  const loadDashboardData = async () => {
    setOrdersLoading(true);
    try {
      // Fetch orders with current filters
      const qParams = new URLSearchParams();
      if (filterPayment) qParams.append('paymentStatus', filterPayment);
      if (filterType) qParams.append('orderType', filterType);
      if (search) qParams.append('search', search);

      const ordRes = await fetch(`/api/admin/orders?${qParams.toString()}`);
      const ordData = await ordRes.json();
      if (ordData.orders) {
        setOrders(ordData.orders);
      }

      // Fetch stock status
      const stkRes = await fetch('/api/admin/stock');
      const stkData = await stkRes.json();
      if (stkData.stock) {
        setStock(stkData.stock);
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setOrdersLoading(false);
    }
  };

  // Reload data whenever filters change
  useEffect(() => {
    if (authenticated) {
      loadDashboardData();
    }
  }, [filterPayment, filterType, search, authenticated]);

  // Login handler
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passcode }),
      });
      if (res.ok) {
        setAuthenticated(true);
        loadDashboardData();
      } else {
        const data = await res.json();
        setLoginError(data.error || 'Incorrect passcode.');
      }
    } catch (err) {
      setLoginError('Authentication failed. Connection issue.');
    }
  };

  // Logout handler
  const handleLogout = async () => {
    try {
      await fetch('/api/admin/auth', { method: 'DELETE' });
      setAuthenticated(false);
      setPasscode('');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  // Toggle Cookie Stock setting in DB
  const handleStockToggle = async (item) => {
    const updatedStock = { ...stock, [item]: !stock[item] };
    setStock(updatedStock); // optimistic update

    try {
      const res = await fetch('/api/admin/stock', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: updatedStock }),
      });
      if (!res.ok) {
        // revert on failure
        setStock(stock);
        alert('Failed to save stock toggle.');
      }
    } catch (err) {
      setStock(stock);
      alert('Network error saving stock status.');
    }
  };

  // Update payment status (Approve / Decline)
  const handleUpdatePayment = async (orderId, status) => {
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, paymentStatus: status }),
      });
      const data = await res.json();
      if (res.ok) {
        // Update local state
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, payment_status: status } : o))
        );
        if (selectedOrder && selectedOrder.id === orderId) {
          setSelectedOrder((prev) => ({ ...prev, payment_status: status }));
        }
        alert(`Payment has been successfully ${status}. Notification email sent.`);
      } else {
        alert(data.error || 'Failed to update payment status.');
      }
    } catch (err) {
      alert('Error updating payment status.');
    }
  };

  // Update order status (Preparing, Completed, etc.)
  const handleUpdateOrderStatus = async (orderId, status) => {
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, orderStatus: status }),
      });
      const data = await res.json();
      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, order_status: status } : o))
        );
        if (selectedOrder && selectedOrder.id === orderId) {
          setSelectedOrder((prev) => ({ ...prev, order_status: status }));
        }
      } else {
        alert(data.error || 'Failed to update order status.');
      }
    } catch (err) {
      alert('Error updating order status.');
    }
  };

  // Export filtered orders to CSV
  const handleExportCSV = () => {
    if (orders.length === 0) return;

    const headers = [
      'Order ID',
      'Date',
      'Name',
      'Email',
      'Phone',
      'Type',
      'Delivery Address',
      'Items Summary',
      'Total Amount',
      'Payment Status',
      'Order Status',
    ];

    const rows = orders.map((o) => {
      const addressStr =
        o.order_type === 'delivery'
          ? `"${o.delivery_street || ''} ${o.delivery_street2 || ''}, ${o.delivery_city || ''}, ${o.delivery_state || ''} ${o.delivery_zip || ''} (Landmark: ${o.delivery_landmark || ''})"`
          : 'N/A';

      const items = [];
      if (o.classic_chocolate_chip_qty > 0) items.push(`Classic Choc Chip (${o.classic_chocolate_chip_qty})`);
      if (o.double_chocolate_qty > 0) items.push(`Double Choc (${o.double_chocolate_qty})`);
      if (o.chocolate_chip_walnut_qty > 0) items.push(`Walnut Choc (${o.chocolate_chip_walnut_qty})`);
      if (o.cookies_cream_qty > 0) items.push(`Cookies & Cream (${o.cookies_cream_qty})`);
      if (o.kunafa_chocolate_qty > 0) items.push(`Kunafa (${o.kunafa_chocolate_qty})`);
      if (o.hazelnut_filled_qty > 0) items.push(`Hazelnut (${o.hazelnut_filled_qty})`);
      if (o.lotus_lava_qty > 0) items.push(`Lotus Lava (${o.lotus_lava_qty})`);
      if (o.classic_bundle_qty > 0) items.push(`Classic Bundle (${o.classic_bundle_qty} - ${o.classic_bundle_flavours})`);
      if (o.premium_bundle_qty > 0) items.push(`Premium Bundle (${o.premium_bundle_qty} - ${o.premium_bundle_flavours})`);
      const itemsSummary = `"${items.join(', ')}"`;

      return [
        o.id,
        new Date(o.created_at).toLocaleDateString(),
        `"${o.first_name} ${o.last_name}"`,
        o.email,
        `'${o.phone}`, // force string in excel
        o.order_type,
        addressStr,
        itemsSummary,
        o.total_amount,
        o.payment_status,
        o.order_status,
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `esero_orders_${new Date().toISOString().substring(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper: Format Cookie Detail String for Modal View
  const getOrderItemsList = (o) => {
    const list = [];
    if (o.classic_chocolate_chip_qty > 0) list.push({ name: 'Classic Chocolate Chip', qty: o.classic_chocolate_chip_qty, price: 580 });
    if (o.double_chocolate_qty > 0) list.push({ name: 'Double Chocolate', qty: o.double_chocolate_qty, price: 580 });
    if (o.chocolate_chip_walnut_qty > 0) list.push({ name: 'Chocolate Chip Walnut', qty: o.chocolate_chip_walnut_qty, price: 580 });
    if (o.cookies_cream_qty > 0) list.push({ name: 'Cookies & Cream', qty: o.cookies_cream_qty, price: 620 });
    if (o.kunafa_chocolate_qty > 0) list.push({ name: 'Kunafa Chocolate', qty: o.kunafa_chocolate_qty, price: 620 });
    if (o.hazelnut_filled_qty > 0) list.push({ name: 'Hazelnut Filled', qty: o.hazelnut_filled_qty, price: 620 });
    if (o.lotus_lava_qty > 0) list.push({ name: 'Lotus Lava', qty: o.lotus_lava_qty, price: 620 });
    if (o.classic_bundle_qty > 0) list.push({ name: 'Classic Bundle (pack of 4)', qty: o.classic_bundle_qty, price: 2200, customFlavours: o.classic_bundle_flavours });
    if (o.premium_bundle_qty > 0) list.push({ name: 'Premium Bundle (pack of 4)', qty: o.premium_bundle_qty, price: 2400, customFlavours: o.premium_bundle_flavours });
    return list;
  };

  // Calculate Metrics
  const totalOrdersCount = orders.length;
  const approvedRevenue = orders
    .filter((o) => o.payment_status === 'approved')
    .reduce((acc, curr) => acc + parseFloat(curr.total_amount), 0);
  const pendingVerificationCount = orders.filter((o) => o.payment_status === 'pending').length;
  const totalCompletedCount = orders.filter((o) => o.order_status === 'completed').length;

  if (authLoading) {
    return (
      <div className={styles.container}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
          <p style={{ fontSize: '1.2rem', color: '#c8a27a' }}>Loading security gate...</p>
        </div>
      </div>
    );
  }

  // Passcode Gate Screen
  if (!authenticated) {
    return (
      <div className={styles.container}>
        <div className={styles.loginContainer}>
          <form onSubmit={handleLogin} className={styles.loginCard} id="admin-login-form">
            <h1 className={styles.loginTitle}>Admin Access</h1>
            <p className={styles.loginText}>Enter the security passcode to manage Cafe Esero preorders.</p>
            <div style={{ marginBottom: '20px' }}>
              <input
                type="password"
                required
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Passcode"
                className={styles.loginInput}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid rgba(200,162,122,0.3)',
                  backgroundColor: 'rgba(0,0,0,0.3)',
                  color: 'white',
                  fontSize: '1.1rem',
                  textAlign: 'center',
                  outline: 'none',
                }}
                id="admin-passcode-field"
              />
            </div>
            {loginError && (
              <p style={{ color: '#e57373', fontSize: '0.85rem', marginBottom: '15px' }}>
                {loginError}
              </p>
            )}
            <button
              type="submit"
              className={styles.exportBtn}
              style={{ width: '100%' }}
              id="admin-login-submit"
            >
              Authorize
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Dashboard Control Screen
  return (
    <div className={styles.container}>
      <div className={styles.inner}>
        {/* Header */}
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>☕ Cafe Esero Admin Dashboard</h1>
            <p className={styles.subtitle}>Manage preorders, verify payments, and control live cookie stock status.</p>
          </div>
          <button className={styles.logoutBtn} onClick={handleLogout} id="admin-logout-btn">
            Logout Session
          </button>
        </header>

        {/* Stats Grid */}
        <section className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Total Preorders</span>
            <p className={styles.statValue}>{totalOrdersCount}</p>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Approved Revenue</span>
            <p className={styles.statValue} style={{ color: '#a5d6a7' }}>
              PKR {approvedRevenue.toLocaleString()}
            </p>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Pending Verification</span>
            <p className={styles.statValue} style={{ color: '#ffe082' }}>
              {pendingVerificationCount}
            </p>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Completed Deliveries</span>
            <p className={styles.statValue} style={{ color: '#81c784' }}>
              {totalCompletedCount}
            </p>
          </div>
        </section>

        {/* Stock Toggle Configuration */}
        <section className={styles.stockCard}>
          <h3 className={styles.stockHeader}>
            <span>🛒 Live Cookie Stock Status (Toggles)</span>
            <small style={{ fontSize: '0.8rem', color: '#a1887f', fontWeight: 'normal' }}>
              Toggling off disables the item on the customer preorder form instantly.
            </small>
          </h3>
          <div className={styles.stockGrid}>
            <div className={styles.stockItem}>
              <span className={styles.stockName}>Classic Chocolate Chip</span>
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={stock.classic_chocolate_chip}
                  onChange={() => handleStockToggle('classic_chocolate_chip')}
                />
                <span className={styles.slider}></span>
              </label>
            </div>
            <div className={styles.stockItem}>
              <span className={styles.stockName}>Double Chocolate</span>
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={stock.double_chocolate}
                  onChange={() => handleStockToggle('double_chocolate')}
                />
                <span className={styles.slider}></span>
              </label>
            </div>
            <div className={styles.stockItem}>
              <span className={styles.stockName}>Chocolate Chip Walnut</span>
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={stock.chocolate_chip_walnut}
                  onChange={() => handleStockToggle('chocolate_chip_walnut')}
                />
                <span className={styles.slider}></span>
              </label>
            </div>
            <div className={styles.stockItem}>
              <span className={styles.stockName}>Cookies & Cream</span>
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={stock.cookies_cream}
                  onChange={() => handleStockToggle('cookies_cream')}
                />
                <span className={styles.slider}></span>
              </label>
            </div>
            <div className={styles.stockItem}>
              <span className={styles.stockName}>Kunafa Chocolate</span>
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={stock.kunafa_chocolate}
                  onChange={() => handleStockToggle('kunafa_chocolate')}
                />
                <span className={styles.slider}></span>
              </label>
            </div>
            <div className={styles.stockItem}>
              <span className={styles.stockName}>Hazelnut Filled</span>
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={stock.hazelnut_filled}
                  onChange={() => handleStockToggle('hazelnut_filled')}
                />
                <span className={styles.slider}></span>
              </label>
            </div>
            <div className={styles.stockItem}>
              <span className={styles.stockName}>Lotus Lava</span>
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={stock.lotus_lava}
                  onChange={() => handleStockToggle('lotus_lava')}
                />
                <span className={styles.slider}></span>
              </label>
            </div>
            <div className={styles.stockItem}>
              <span className={styles.stockName}>Classic Bundle</span>
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={stock.classic_bundle}
                  onChange={() => handleStockToggle('classic_bundle')}
                />
                <span className={styles.slider}></span>
              </label>
            </div>
            <div className={styles.stockItem}>
              <span className={styles.stockName}>Premium Bundle</span>
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={stock.premium_bundle}
                  onChange={() => handleStockToggle('premium_bundle')}
                />
                <span className={styles.slider}></span>
              </label>
            </div>
          </div>
        </section>

        {/* Filter Rows & Export Actions */}
        <section className={styles.filterRow}>
          <div className={styles.searchContainer}>
            <input
              type="text"
              placeholder="Search by name, phone, email, or order ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={styles.loginInput}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid rgba(200,162,122,0.15)',
                backgroundColor: 'rgba(255,255,255,0.03)',
                color: 'white',
              }}
              id="admin-search-field"
            />
          </div>
          <div className={styles.filterGroup}>
            <select
              value={filterPayment}
              onChange={(e) => setFilterPayment(e.target.value)}
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid rgba(200,162,122,0.15)',
                backgroundColor: '#1e140f',
                color: 'white',
              }}
              id="admin-filter-payment"
            >
              <option value="">All Payments</option>
              <option value="pending">Pending Verification</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid rgba(200,162,122,0.15)',
                backgroundColor: '#1e140f',
                color: 'white',
              }}
              id="admin-filter-type"
            >
              <option value="">All Order Types</option>
              <option value="dine_in">Dine-in</option>
              <option value="takeaway">Takeaway</option>
              <option value="delivery">Delivery</option>
            </select>
            <button className={styles.exportBtn} onClick={handleExportCSV} id="admin-export-btn">
              Export CSV
            </button>
          </div>
        </section>

        {/* Orders Table */}
        <section className={styles.tableContainer}>
          {ordersLoading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <p style={{ color: '#c8a27a' }}>Querying database rows...</p>
            </div>
          ) : orders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <p style={{ color: '#a1887f' }}>No preorder bookings matching current parameters.</p>
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Order ID (Ref)</th>
                  <th>Date</th>
                  <th>Customer Name</th>
                  <th>Phone Number</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Payment</th>
                  <th>Order Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => setSelectedOrder(o)}
                    style={{ cursor: 'pointer' }}
                    id={`order-row-${o.id.substring(0,8)}`}
                  >
                    <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                      {o.id.substring(0, 8).toUpperCase()}
                    </td>
                    <td>{new Date(o.created_at).toLocaleDateString()}</td>
                    <td>{o.first_name} {o.last_name}</td>
                    <td>{o.phone}</td>
                    <td>
                      <span style={{ textTransform: 'capitalize' }}>
                        {o.order_type.replace('_', ' ')}
                      </span>
                    </td>
                    <td>PKR {parseInt(o.total_amount, 10).toLocaleString()}</td>
                    <td>
                      <span
                        className={`${styles.badgeStatus} ${
                          o.payment_status === 'pending'
                            ? styles.statusPending
                            : o.payment_status === 'approved'
                            ? styles.statusApproved
                            : styles.statusRejected
                        }`}
                      >
                        {o.payment_status}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`${styles.badgeStatus} ${
                          o.order_status === 'received'
                            ? styles.statusPending
                            : o.order_status === 'preparing'
                            ? styles.statusPreparing
                            : o.order_status === 'completed'
                            ? styles.statusCompleted
                            : styles.statusRejected
                        }`}
                      >
                        {o.order_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {/* Detail Modal */}
      {selectedOrder && (
        <div className={styles.modalOverlay} onClick={() => setSelectedOrder(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 style={{ margin: 0, color: '#c8a27a', fontSize: '1.25rem' }}>
                Preorder Details (Ref: #{selectedOrder.id.substring(0, 8).toUpperCase()})
              </h2>
              <button
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#a1887f',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                }}
                onClick={() => setSelectedOrder(null)}
              >
                &times;
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.modalGrid}>
                {/* Column 1: Info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className={styles.infoSection}>
                    <h4>👤 Customer Details</h4>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Full Name:</span>
                      <span className={styles.detailValue}>
                        {selectedOrder.first_name} {selectedOrder.last_name}
                      </span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Phone / WhatsApp:</span>
                      <span className={styles.detailValue}>{selectedOrder.phone}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Email Address:</span>
                      <span className={styles.detailValue} style={{ wordBreak: 'break-all' }}>
                        {selectedOrder.email}
                      </span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Order Type:</span>
                      <span className={styles.detailValue} style={{ textTransform: 'capitalize' }}>
                        {selectedOrder.order_type.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  {selectedOrder.order_type === 'delivery' && (
                    <div className={styles.infoSection}>
                      <h4>🛵 Delivery Location</h4>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Street:</span>
                        <span className={styles.detailValue}>{selectedOrder.delivery_street}</span>
                      </div>
                      {selectedOrder.delivery_street2 && (
                        <div className={styles.detailRow}>
                          <span className={styles.detailLabel}>Line 2:</span>
                          <span className={styles.detailValue}>{selectedOrder.delivery_street2}</span>
                        </div>
                      )}
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>City:</span>
                        <span className={styles.detailValue}>{selectedOrder.delivery_city}</span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>State/Province:</span>
                        <span className={styles.detailValue}>{selectedOrder.delivery_state}</span>
                      </div>
                      {selectedOrder.delivery_zip && (
                        <div className={styles.detailRow}>
                          <span className={styles.detailLabel}>Zip Code:</span>
                          <span className={styles.detailValue}>{selectedOrder.delivery_zip}</span>
                        </div>
                      )}
                      {selectedOrder.delivery_landmark && (
                        <div className={styles.detailRow}>
                          <span className={styles.detailLabel}>Landmark:</span>
                          <span className={styles.detailValue}>{selectedOrder.delivery_landmark}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className={styles.infoSection}>
                    <h4>🍪 Order Quantities</h4>
                    {getOrderItemsList(selectedOrder).map((item) => (
                      <div key={item.name} style={{ marginBottom: '10px', fontSize: '0.85rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                          <span>{item.name} x {item.qty}</span>
                          <span>PKR {(item.qty * item.price).toLocaleString()}</span>
                        </div>
                        {item.customFlavours && (
                          <div style={{ color: '#a1887f', fontSize: '0.75rem', marginTop: '3px', paddingLeft: '10px' }}>
                            Flavours: {item.customFlavours}
                          </div>
                        )}
                      </div>
                    ))}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontWeight: 'bold',
                        borderTop: '1px solid rgba(200, 162, 122, 0.15)',
                        paddingTop: '10px',
                        marginTop: '10px',
                        fontSize: '0.95rem',
                        color: '#c8a27a',
                      }}
                    >
                      <span>Total Invoice:</span>
                      <span>PKR {parseInt(selectedOrder.total_amount, 10).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Column 2: Payment Proof Screenshot */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className={styles.infoSection} style={{ flex: 1 }}>
                    <h4>📸 Payment proof Screenshot</h4>
                    <div className={styles.proofContainer}>
                      {selectedOrder.payment_proof_url.endsWith('.pdf') ? (
                        <a
                          href={selectedOrder.payment_proof_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            color: '#c8a27a',
                            fontWeight: 'bold',
                            display: 'inline-block',
                            padding: '15px',
                            backgroundColor: 'rgba(255,255,255,0.05)',
                            borderRadius: '8px',
                            border: '1px solid rgba(200,162,122,0.15)',
                            textDecoration: 'none',
                          }}
                        >
                          📄 View PDF Payment Slip
                        </a>
                      ) : (
                        <div>
                          <img
                            src={selectedOrder.payment_proof_url}
                            alt="Payment receipt proof"
                            className={styles.proofImg}
                            onClick={() => setZoomedImg(selectedOrder.payment_proof_url)}
                          />
                          <p style={{ fontSize: '0.75rem', color: '#a1887f', margin: '8px 0 0 0' }}>
                            Click image to zoom/inspect receipt
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={styles.infoSection}>
                    <h4>⚙️ Status Actions</h4>
                    <div className={styles.detailRow} style={{ marginBottom: '15px', alignItems: 'center' }}>
                      <span className={styles.detailLabel}>Verify Transfer:</span>
                      <span className={styles.detailValue}>
                        <span
                          className={`${styles.badgeStatus} ${
                            selectedOrder.payment_status === 'pending'
                              ? styles.statusPending
                              : selectedOrder.payment_status === 'approved'
                              ? styles.statusApproved
                              : styles.statusRejected
                          }`}
                        >
                          {selectedOrder.payment_status}
                        </span>
                      </span>
                    </div>
                    <div className={styles.detailRow} style={{ alignItems: 'center', marginBottom: '15px' }}>
                      <span className={styles.detailLabel}>Order Status:</span>
                      <span className={styles.detailValue}>
                        <select
                          value={selectedOrder.order_status}
                          onChange={(e) => handleUpdateOrderStatus(selectedOrder.id, e.target.value)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '6px',
                            backgroundColor: '#130c08',
                            color: 'white',
                            border: '1px solid rgba(200,162,122,0.2)',
                            outline: 'none',
                          }}
                          id="admin-change-order-status"
                        >
                          <option value="received">Received</option>
                          <option value="preparing">Preparing</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                      <button
                        onClick={() => handleUpdatePayment(selectedOrder.id, 'approved')}
                        disabled={selectedOrder.payment_status === 'approved'}
                        className={`${styles.actionBtn} ${styles.btnApprove}`}
                        style={{ flex: 1 }}
                        id="admin-btn-approve-payment"
                      >
                        Approve Payment
                      </button>
                      <button
                        onClick={() => handleUpdatePayment(selectedOrder.id, 'rejected')}
                        disabled={selectedOrder.payment_status === 'rejected'}
                        className={`${styles.actionBtn} ${styles.btnDecline}`}
                        style={{ flex: 1 }}
                        id="admin-btn-reject-payment"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.actionBlock}>
                <button className={`${styles.actionBtn} ${styles.btnClose}`} onClick={() => setSelectedOrder(null)}>
                  Close Details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Receipt Zoom */}
      {zoomedImg && (
        <div className={styles.zoomOverlay} onClick={() => setZoomedImg(null)}>
          <img src={zoomedImg} alt="Zoomed payment receipt" className={styles.zoomImg} />
        </div>
      )}
    </div>
  );
}
