'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './admin.module.css';

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [passcode, setPasscode] = useState('');
  const [loginError, setLoginError] = useState('');

  // Active Tab: 'orders' | 'menu' | 'batches' | 'settings'
  const [activeTab, setActiveTab] = useState('orders');

  // Dashboard Data: Orders
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const lastRequestTime = useRef(0);

  // Batches State (Pre-Order 1, Pre-Order 2, etc.)
  const [batches, setBatches] = useState([]);
  const [activeBatchId, setActiveBatchId] = useState('batch_1');
  const [batchFilter, setBatchFilter] = useState('all');
  const [batchStats, setBatchStats] = useState({});
  const [showNewBatchModal, setShowNewBatchModal] = useState(false);
  const [newBatchForm, setNewBatchForm] = useState({
    name: '',
    notes: '',
    resetStock: true,
    setActive: true,
  });

  // Stock & Dynamic Menu Items State
  const [stock, setStock] = useState({});
  const [menuItems, setMenuItems] = useState([]);
  const [bundleSettings, setBundleSettings] = useState({
    classic_bundle: { price: 2200, is_active: true },
    premium_bundle: { price: 2400, is_active: true },
  });

  // Menu Items CRUD Modals
  const [showAddMenuModal, setShowAddMenuModal] = useState(false);
  const [menuForm, setMenuForm] = useState({
    name: '',
    category: 'classic',
    price: 600,
    availableStock: 100,
    initialStock: 100,
    isActive: true,
  });
  const [editingMenuItem, setEditingMenuItem] = useState(null);
  const [itemToDelete, setItemToDelete] = useState(null);

  // Filters and search
  const [search, setSearch] = useState('');
  const [filterPayment, setFilterPayment] = useState('');
  const [filterType, setFilterType] = useState('');

  // Order Selection & Bulk Actions
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [orderToDelete, setOrderToDelete] = useState(null); // Single order or 'bulk'
  const [restoreStockOnDelete, setRestoreStockOnDelete] = useState(true);

  // Selected Order for Detail Modal
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [zoomedImg, setZoomedImg] = useState(null);

  // Editing Order State
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    batchName: 'Pre-Order 1',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    orderType: 'takeaway',
    deliveryStreet: '',
    deliveryStreet2: '',
    deliveryCity: '',
    deliveryState: '',
    deliveryZip: '',
    deliveryLandmark: '',
    paymentProofUrl: '',
  });
  const [isUploading, setIsUploading] = useState(false);

  // Custom Order Creation State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    batchName: 'Pre-Order 1',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    orderType: 'takeaway',
    deliveryStreet: '',
    deliveryStreet2: '',
    deliveryCity: '',
    deliveryState: '',
    deliveryZip: '',
    deliveryLandmark: '',
    paymentProofUrl: 'whatsapp_verified',
    paymentStatus: 'approved',
    orderStatus: 'received',
    classicBundleFlavours: '',
    premiumBundleFlavours: '',
  });
  const [createFormQuantities, setCreateFormQuantities] = useState({});

  // Announcement / Main Page Updates
  const [announcementForm, setAnnouncementForm] = useState({ text: '', isActive: false });

  // Fulfillment Options (Delivery & Pickup)
  const [orderSettings, setOrderSettings] = useState({
    isDeliveryEnabled: true,
    isPickupEnabled: true,
  });

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

  // Fetch orders, stock, batches, announcements
  const loadDashboardData = async () => {
    const requestId = Date.now();
    lastRequestTime.current = requestId;
    setOrdersLoading(true);

    try {
      // 1. Fetch batches
      const batchRes = await fetch('/api/admin/batches');
      if (batchRes.ok) {
        const bData = await batchRes.json();
        if (requestId === lastRequestTime.current) {
          setBatches(bData.batches || []);
          setActiveBatchId(bData.activeBatchId || '');
          setBatchStats(bData.stats || {});
          if (bData.activeBatch?.name && !createForm.batchName) {
            setCreateForm((prev) => ({ ...prev, batchName: bData.activeBatch.name }));
          }
        }
      }

      // 2. Fetch orders with filters
      const qParams = new URLSearchParams();
      if (filterPayment) qParams.append('paymentStatus', filterPayment);
      if (filterType) qParams.append('orderType', filterType);
      if (batchFilter && batchFilter !== 'all') qParams.append('batch', batchFilter);
      if (search) qParams.append('search', search);

      const ordRes = await fetch(`/api/admin/orders?${qParams.toString()}`);
      const ordData = await ordRes.json();
      if (requestId === lastRequestTime.current && ordData.orders) {
        setOrders(ordData.orders);
      }

      // 3. Fetch stock status & dynamic menu items
      const stkRes = await fetch('/api/admin/stock');
      const stkData = await stkRes.json();
      if (requestId === lastRequestTime.current) {
        if (stkData.stock) setStock(stkData.stock);
        if (stkData.items) {
          setMenuItems(stkData.items);
          // Initialize create form quantities if empty
          setCreateFormQuantities((prev) => {
            const initialMap = { ...prev };
            stkData.items.forEach((item) => {
              if (initialMap[item.key] === undefined) initialMap[item.key] = 0;
            });
            initialMap['classic_bundle'] = initialMap['classic_bundle'] || 0;
            initialMap['premium_bundle'] = initialMap['premium_bundle'] || 0;
            return initialMap;
          });
        }
        if (stkData.bundles) setBundleSettings(stkData.bundles);
      }

      // 4. Fetch announcement status
      const annRes = await fetch('/api/announcement');
      const annData = await annRes.json();
      if (requestId === lastRequestTime.current) {
        setAnnouncementForm({
          text: annData.text || '',
          isActive: annData.isActive || false,
        });
      }

      // 5. Fetch fulfillment options
      const setRes = await fetch('/api/order-settings');
      if (setRes.ok) {
        const setData = await setRes.json();
        if (requestId === lastRequestTime.current) {
          setOrderSettings({
            isDeliveryEnabled: setData.isDeliveryEnabled ?? true,
            isPickupEnabled: setData.isPickupEnabled ?? true,
          });
        }
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      if (requestId === lastRequestTime.current) {
        setOrdersLoading(false);
      }
    }
  };

  // Reload data whenever filters change
  useEffect(() => {
    if (authenticated) {
      loadDashboardData();
    }
  }, [filterPayment, filterType, batchFilter, search, authenticated]);

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

  // ==========================================
  // BATCH MANAGEMENT HANDLERS (Pre-Order 1, 2)
  // ==========================================
  const handleCreateBatch = async (e) => {
    e.preventDefault();
    if (!newBatchForm.name.trim()) return;

    try {
      const res = await fetch('/api/admin/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBatchForm),
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Successfully created "${newBatchForm.name}"!`);
        setShowNewBatchModal(false);
        setNewBatchForm({
          name: '',
          notes: '',
          resetStock: true,
          setActive: true,
        });
        loadDashboardData();
      } else {
        alert(data.error || 'Failed to create batch.');
      }
    } catch (err) {
      alert('Error creating batch.');
    }
  };

  const handleSwitchActiveBatch = async (bId) => {
    try {
      const res = await fetch('/api/admin/batches', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeBatchId: bId }),
      });
      if (res.ok) {
        setActiveBatchId(bId);
        loadDashboardData();
      } else {
        alert('Failed to switch active batch.');
      }
    } catch (err) {
      alert('Error switching batch.');
    }
  };

  const handleResetAllStock = async () => {
    if (!confirm('Are you sure you want to reset all cookie available stock back to their initial target quantities?')) {
      return;
    }
    try {
      const res = await fetch('/api/admin/batches', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetStock: true }),
      });
      if (res.ok) {
        alert('All cookie inventory has been reset to initial targets!');
        loadDashboardData();
      } else {
        alert('Failed to reset stock.');
      }
    } catch (err) {
      alert('Error resetting stock.');
    }
  };

  const handleDeleteBatch = async (bId, bName) => {
    if (!confirm(`Are you sure you want to delete batch "${bName}"?`)) return;
    try {
      const res = await fetch(`/api/admin/batches?batchId=${bId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Batch "${bName}" deleted.`);
        loadDashboardData();
      } else {
        alert(data.error || 'Failed to delete batch.');
      }
    } catch (err) {
      alert('Error deleting batch.');
    }
  };

  // ==========================================
  // MENU ITEMS CRUD HANDLERS
  // ==========================================
  const handleCreateMenuItem = async (e) => {
    e.preventDefault();
    if (!menuForm.name.trim()) return;

    try {
      const res = await fetch('/api/admin/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(menuForm),
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Added "${menuForm.name}" to menu!`);
        setShowAddMenuModal(false);
        setMenuForm({
          name: '',
          category: 'classic',
          price: 600,
          availableStock: 100,
          initialStock: 100,
          isActive: true,
        });
        loadDashboardData();
      } else {
        alert(data.error || 'Failed to add item.');
      }
    } catch (err) {
      alert('Network error adding menu item.');
    }
  };

  const handleSaveEditMenuItem = async (e) => {
    e.preventDefault();
    if (!editingMenuItem) return;

    try {
      const res = await fetch('/api/admin/stock', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flavorKey: editingMenuItem.key,
          name: editingMenuItem.name,
          category: editingMenuItem.category,
          price: editingMenuItem.price,
          availableStock: editingMenuItem.available,
          initialStock: editingMenuItem.initial,
          isActive: editingMenuItem.is_active,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        alert('Menu item updated successfully!');
        setEditingMenuItem(null);
        loadDashboardData();
      } else {
        alert(data.error || 'Failed to update item.');
      }
    } catch (err) {
      alert('Network error updating menu item.');
    }
  };

  const handleDeleteMenuItem = async () => {
    if (!itemToDelete) return;
    try {
      const res = await fetch(`/api/admin/stock?flavorKey=${itemToDelete.key}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Deleted "${itemToDelete.name}" from menu.`);
        setItemToDelete(null);
        loadDashboardData();
      } else {
        alert(data.error || 'Failed to delete item.');
      }
    } catch (err) {
      alert('Error deleting menu item.');
    }
  };

  const handleStockFieldChange = (flavorKey, field, value) => {
    setStock((prev) => ({
      ...prev,
      [flavorKey]: {
        ...prev[flavorKey],
        [field]: value,
      },
    }));
    setMenuItems((prev) =>
      prev.map((item) =>
        item.key === flavorKey ? { ...item, [field]: value } : item
      )
    );
  };

  const handleUpdateStockRow = async (flavorKey, availableStock, initialStock, price, isActive) => {
    try {
      const res = await fetch('/api/admin/stock', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flavorKey, availableStock, initialStock, price, isActive }),
      });
      if (res.ok) {
        alert(`Updated ${flavorKey.replace(/_/g, ' ')}.`);
        loadDashboardData();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update stock.');
      }
    } catch (err) {
      alert('Network error saving stock changes.');
    }
  };

  // ==========================================
  // ORDERS CRUD & DELETION HANDLERS
  // ==========================================
  const handleConfirmDeleteOrder = async () => {
    if (!orderToDelete) return;

    try {
      if (orderToDelete === 'bulk') {
        // Bulk delete
        const res = await fetch('/api/admin/orders', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderIds: selectedOrderIds,
            restoreStock: restoreStockOnDelete,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          alert(`Deleted ${selectedOrderIds.length} orders.`);
          setSelectedOrderIds([]);
          setOrderToDelete(null);
          loadDashboardData();
        } else {
          alert(data.error || 'Failed to delete orders.');
        }
      } else {
        // Single order delete
        const res = await fetch(
          `/api/admin/orders?orderId=${orderToDelete.id}&restoreStock=${restoreStockOnDelete}`,
          { method: 'DELETE' }
        );
        const data = await res.json();
        if (res.ok) {
          alert('Order deleted successfully.');
          if (selectedOrder?.id === orderToDelete.id) {
            setSelectedOrder(null);
          }
          setOrderToDelete(null);
          loadDashboardData();
        } else {
          alert(data.error || 'Failed to delete order.');
        }
      }
    } catch (err) {
      alert('Error deleting order.');
    }
  };

  const handleSelectAllOrders = (e) => {
    if (e.target.checked) {
      setSelectedOrderIds(orders.map((o) => o.id));
    } else {
      setSelectedOrderIds([]);
    }
  };

  const handleToggleSelectOrder = (orderId, e) => {
    e.stopPropagation();
    setSelectedOrderIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  const handleBulkUpdatePayment = async (status) => {
    if (selectedOrderIds.length === 0) return;
    if (!confirm(`Are you sure you want to mark ${selectedOrderIds.length} orders as "${status}"?`)) return;

    for (const id of selectedOrderIds) {
      await fetch('/api/admin/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: id, paymentStatus: status }),
      });
    }
    alert(`Updated ${selectedOrderIds.length} orders to payment status: ${status}.`);
    setSelectedOrderIds([]);
    loadDashboardData();
  };

  const handleBulkUpdateOrderStatus = async (status) => {
    if (selectedOrderIds.length === 0) return;
    if (!confirm(`Are you sure you want to mark ${selectedOrderIds.length} orders as "${status}"?`)) return;

    for (const id of selectedOrderIds) {
      await fetch('/api/admin/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: id, orderStatus: status }),
      });
    }
    alert(`Updated ${selectedOrderIds.length} orders to order status: ${status}.`);
    setSelectedOrderIds([]);
    loadDashboardData();
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

  // Start editing selected order
  const startEditing = () => {
    if (!selectedOrder) return;
    setEditForm({
      batchName: selectedOrder.batch_name || 'Pre-Order 1',
      firstName: selectedOrder.first_name || '',
      lastName: selectedOrder.last_name || '',
      email: selectedOrder.email || '',
      phone: selectedOrder.phone || '',
      orderType: selectedOrder.order_type || 'takeaway',
      deliveryStreet: selectedOrder.delivery_street || '',
      deliveryStreet2: selectedOrder.delivery_street2 || '',
      deliveryCity: selectedOrder.delivery_city || '',
      deliveryState: selectedOrder.delivery_state || '',
      deliveryZip: selectedOrder.delivery_zip || '',
      deliveryLandmark: selectedOrder.delivery_landmark || '',
      paymentProofUrl: selectedOrder.payment_proof_url || '',
    });
    setIsEditing(true);
  };

  const handleEditFormChange = (field, val) => {
    setEditForm((prev) => ({ ...prev, [field]: val }));
  };

  // Upload replacement screenshot
  const handleUploadReplacementScreenshot = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.url) {
        handleEditFormChange('paymentProofUrl', data.url);
        alert('Replacement screenshot uploaded successfully.');
      } else {
        alert(data.error || 'Screenshot upload failed.');
      }
    } catch (err) {
      alert('Error uploading screenshot.');
    } finally {
      setIsUploading(false);
    }
  };

  // Save edited order
  const handleSaveEditedOrder = async () => {
    if (!selectedOrder) return;
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: selectedOrder.id,
          batchName: editForm.batchName,
          firstName: editForm.firstName,
          lastName: editForm.lastName,
          email: editForm.email,
          phone: editForm.phone,
          orderType: editForm.orderType,
          deliveryStreet: editForm.deliveryStreet,
          deliveryStreet2: editForm.deliveryStreet2,
          deliveryCity: editForm.deliveryCity,
          deliveryState: editForm.deliveryState,
          deliveryZip: editForm.deliveryZip,
          deliveryLandmark: editForm.deliveryLandmark,
          paymentProofUrl: editForm.paymentProofUrl,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const updated = {
          ...selectedOrder,
          batch_name: editForm.batchName,
          first_name: editForm.firstName,
          last_name: editForm.lastName,
          email: editForm.email,
          phone: editForm.phone,
          order_type: editForm.orderType,
          delivery_street: editForm.deliveryStreet,
          delivery_street2: editForm.deliveryStreet2,
          delivery_city: editForm.deliveryCity,
          delivery_state: editForm.deliveryState,
          delivery_zip: editForm.deliveryZip,
          delivery_landmark: editForm.deliveryLandmark,
          payment_proof_url: editForm.paymentProofUrl,
        };
        setSelectedOrder(updated);
        setOrders((prev) => prev.map((o) => (o.id === selectedOrder.id ? updated : o)));
        setIsEditing(false);
        alert('Order updated successfully.');
      } else {
        alert(data.error || 'Failed to save edits.');
      }
    } catch (err) {
      alert('Network error saving edits.');
    }
  };

  // Submit custom preorder created by admin
  const handleCreateCustomOrder = async () => {
    if (!createForm.firstName || !createForm.phone || !createForm.email) {
      alert('First Name, Phone, and Email are required.');
      return;
    }

    const subtotal = Object.entries(createFormQuantities).reduce((acc, [item, qty]) => {
      const itemPrice = stock[item]?.price || 0;
      return acc + qty * itemPrice;
    }, 0);
    const deliveryFee = createForm.orderType === 'delivery' ? 300 : 0;
    const totalAmount = subtotal + deliveryFee;

    try {
      const payload = {
        batchName: createForm.batchName || 'Pre-Order 1',
        firstName: createForm.firstName,
        lastName: createForm.lastName,
        email: createForm.email,
        phone: createForm.phone,
        orderType: createForm.orderType,
        deliveryStreet: createForm.deliveryStreet,
        deliveryStreet2: createForm.deliveryStreet2,
        deliveryCity: createForm.deliveryCity,
        deliveryState: createForm.deliveryState,
        deliveryZip: createForm.deliveryZip,
        deliveryLandmark: createForm.deliveryLandmark,
        classicChocolateChipQty: createFormQuantities.classic_chocolate_chip || 0,
        doubleChocolateQty: createFormQuantities.double_chocolate || 0,
        chocolateChipWalnutQty: createFormQuantities.chocolate_chip_walnut || 0,
        cookiesCreamQty: createFormQuantities.cookies_cream || 0,
        kunafaChocolateQty: createFormQuantities.kunafa_chocolate || 0,
        hazelnutFilledQty: createFormQuantities.hazelnut_filled || 0,
        lotusLavaQty: createFormQuantities.lotus_lava || 0,
        classicBundleQty: createFormQuantities.classic_bundle || 0,
        classicBundleFlavours: createForm.classicBundleFlavours,
        premiumBundleQty: createFormQuantities.premium_bundle || 0,
        premiumBundleFlavours: createForm.premiumBundleFlavours,
        totalAmount,
        paymentProofUrl: createForm.paymentProofUrl || 'whatsapp_verified',
        paymentStatus: createForm.paymentStatus,
        orderStatus: createForm.orderStatus,
      };

      const res = await fetch('/api/admin/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        alert('Custom preorder created successfully!');
        setShowCreateModal(false);
        loadDashboardData();
      } else {
        alert(data.error || 'Failed to create preorder. Stock check failed.');
      }
    } catch (err) {
      alert('Error creating preorder.');
    }
  };

  // Save/Update announcement
  const handleUpdateAnnouncement = async () => {
    try {
      const res = await fetch('/api/announcement', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(announcementForm),
      });
      if (res.ok) {
        alert('Announcement updated successfully!');
      } else {
        alert('Failed to update announcement.');
      }
    } catch (err) {
      alert('Error updating announcement.');
    }
  };

  // Save/Update order fulfillment options
  const handleUpdateOrderSettings = async () => {
    try {
      const res = await fetch('/api/order-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderSettings),
      });
      if (res.ok) {
        alert('Fulfillment & Order options updated successfully!');
      } else {
        alert('Failed to update order settings.');
      }
    } catch (err) {
      alert('Error updating order settings.');
    }
  };

  // Export filtered orders to CSV
  const handleExportCSV = () => {
    if (orders.length === 0) return;

    const headers = [
      'Order ID',
      'Round / Batch',
      'Date',
      'Name',
      'Email',
      'Phone',
      'Type',
      'Delivery Address',
      'Total Amount',
      'Payment Status',
      'Order Status',
    ];

    const rows = orders.map((o) => {
      const addressStr =
        o.order_type === 'delivery'
          ? `"${o.delivery_street || ''} ${o.delivery_street2 || ''}, ${o.delivery_city || ''}, ${o.delivery_state || ''} ${o.delivery_zip || ''} (Landmark: ${o.delivery_landmark || ''})"`
          : 'N/A';

      return [
        o.id,
        o.batch_name || 'Pre-Order 1',
        new Date(o.created_at).toLocaleDateString(),
        `"${o.first_name} ${o.last_name}"`,
        o.email,
        `'${o.phone}`,
        o.order_type,
        addressStr,
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
    link.setAttribute('download', `esero_orders_${new Date().toISOString().substring(0, 10)}.csv`);
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

  // Calculate Metrics (filtered by currently selected batch or all)
  const totalOrdersCount = orders.length;
  const approvedRevenue = orders
    .filter((o) => o.payment_status === 'approved')
    .reduce((acc, curr) => acc + parseFloat(curr.total_amount || 0), 0);
  const pendingVerificationCount = orders.filter((o) => o.payment_status === 'pending').length;
  const totalCompletedCount = orders.filter((o) => o.order_status === 'completed').length;

  const activeBatchObj = batches.find((b) => b.id === activeBatchId) || batches[0] || { name: 'Pre-Order 1' };

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <h1 className={styles.title}>☕ Cafe Esero Admin Dashboard</h1>
              <span
                style={{
                  background: 'rgba(129, 199, 132, 0.15)',
                  border: '1px solid #81c784',
                  color: '#81c784',
                  padding: '4px 12px',
                  borderRadius: '16px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#81c784' }}></span>
                Active: {activeBatchObj?.name || 'Pre-Order 1'}
              </span>
            </div>
            <p className={styles.subtitle}>
              Full control to update and delete menu items, inventory, and preorders organized by round.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className={styles.saveStockBtn}
              style={{ height: '38px', padding: '0 16px', whiteSpace: 'nowrap' }}
              onClick={() => {
                setNewBatchForm({
                  name: `Pre-Order ${batches.length + 1}`,
                  notes: '',
                  resetStock: true,
                  setActive: true,
                });
                setShowNewBatchModal(true);
              }}
              id="admin-new-round-btn"
            >
              🔄 Start New Round
            </button>
            <button
              className={styles.saveStockBtn}
              style={{ height: '38px', padding: '0 16px', whiteSpace: 'nowrap', background: '#3e2723' }}
              onClick={() => setShowAddMenuModal(true)}
              id="admin-add-item-btn"
            >
              ➕ Add Menu Item
            </button>
            <button
              className={styles.saveStockBtn}
              style={{ height: '38px', padding: '0 16px', whiteSpace: 'nowrap' }}
              onClick={() => setShowCreateModal(true)}
              id="admin-create-custom-order-btn"
            >
              📝 Create Order
            </button>
            <button className={styles.logoutBtn} onClick={handleLogout} id="admin-logout-btn">
              Logout
            </button>
          </div>
        </header>

        {/* Tab Navigation */}
        <nav className={styles.tabNav}>
          <button
            className={`${styles.tabBtn} ${activeTab === 'orders' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            📋 Pre-Orders ({orders.length})
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'menu' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('menu')}
          >
            🍪 Menu Items & Stock ({menuItems.length})
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'batches' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('batches')}
          >
            📦 Pre-Order Rounds ({batches.length})
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'settings' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            ⚙️ Fulfillment & Banner
          </button>
        </nav>

        {/* ============================================================ */}
        {/* TAB 1: ORDERS & BATCH FILTERING */}
        {/* ============================================================ */}
        {activeTab === 'orders' && (
          <div>
            {/* Metrics Row */}
            <section className={styles.statsGrid}>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>
                  {batchFilter === 'all' ? 'Total Orders' : `${batchFilter} Orders`}
                </span>
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

            {/* Bulk Actions Toolbar (Visible when 1+ rows selected) */}
            {selectedOrderIds.length > 0 && (
              <div className={styles.bulkBar}>
                <div className={styles.bulkBarInfo}>
                  <span>✓ {selectedOrderIds.length} orders selected</span>
                  <button
                    style={{ background: 'none', border: 'none', color: '#c8a27a', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}
                    onClick={() => setSelectedOrderIds([])}
                  >
                    Deselect All
                  </button>
                </div>
                <div className={styles.bulkBarActions}>
                  <button
                    className={styles.bulkBtnSuccess}
                    onClick={() => handleBulkUpdatePayment('approved')}
                  >
                    ✅ Mark Approved
                  </button>
                  <button
                    className={styles.bulkBtnSuccess}
                    onClick={() => handleBulkUpdateOrderStatus('completed')}
                  >
                    📦 Mark Completed
                  </button>
                  <button
                    className={styles.bulkBtnDanger}
                    onClick={() => {
                      setOrderToDelete('bulk');
                      setRestoreStockOnDelete(true);
                    }}
                  >
                    🗑️ Delete Selected ({selectedOrderIds.length})
                  </button>
                </div>
              </div>
            )}

            {/* Search & Filter Bar */}
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
                {/* Round / Batch Filter */}
                <select
                  value={batchFilter}
                  onChange={(e) => setBatchFilter(e.target.value)}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: '1.5px solid rgba(200,162,122,0.3)',
                    backgroundColor: '#1e140f',
                    color: '#f5cf73',
                    fontWeight: 'bold',
                  }}
                  id="admin-filter-batch"
                >
                  <option value="all">📁 All Pre-Order Rounds</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.name}>
                      {b.name} {b.id === activeBatchId ? '(Active)' : ''}
                    </option>
                  ))}
                </select>

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
                  <p style={{ color: '#c8a27a' }}>Querying database preorders...</p>
                </div>
              ) : orders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <p style={{ color: '#a1887f' }}>No preorder bookings matching current parameters.</p>
                </div>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>
                        <input
                          type="checkbox"
                          className={styles.rowCheckbox}
                          checked={orders.length > 0 && selectedOrderIds.length === orders.length}
                          onChange={handleSelectAllOrders}
                        />
                      </th>
                      <th>Order ID (Ref)</th>
                      <th>Round</th>
                      <th>Date</th>
                      <th>Customer Name</th>
                      <th>Phone Number</th>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>Payment</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr
                        key={o.id}
                        onClick={() => setSelectedOrder(o)}
                        style={{ cursor: 'pointer' }}
                        id={`order-row-${o.id.substring(0, 8)}`}
                      >
                        <td onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className={styles.rowCheckbox}
                            checked={selectedOrderIds.includes(o.id)}
                            onChange={(e) => handleToggleSelectOrder(o.id, e)}
                          />
                        </td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                          {o.id.substring(0, 8).toUpperCase()}
                        </td>
                        <td>
                          <span
                            style={{
                              background: 'rgba(200, 162, 122, 0.12)',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              color: '#c8a27a',
                              fontWeight: 600,
                            }}
                          >
                            {o.batch_name || 'Pre-Order 1'}
                          </span>
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
                        <td onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              className={styles.btnEdit}
                              onClick={() => setSelectedOrder(o)}
                              title="View & Edit"
                            >
                              👁️
                            </button>
                            <button
                              className={styles.btnDelete}
                              onClick={() => {
                                setOrderToDelete(o);
                                setRestoreStockOnDelete(true);
                              }}
                              title="Delete Order"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: MENU ITEMS & INVENTORY CRUD */}
        {/* ============================================================ */}
        {activeTab === 'menu' && (
          <div>
            <section className={styles.stockCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '20px' }}>
                <div>
                  <h3 className={styles.stockHeader} style={{ margin: 0 }}>
                    <span>🍪 Live Menu Items & Inventory Management</span>
                  </h3>
                  <small style={{ fontSize: '0.8rem', color: '#a1887f', display: 'block', marginTop: '4px' }}>
                    Add, edit, or permanently delete cookie flavours and bundles. Any changes reflect live on the customer preorder form.
                  </small>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    className={styles.saveStockBtn}
                    style={{ background: '#2e7d32' }}
                    onClick={() => setShowAddMenuModal(true)}
                  >
                    ➕ Add New Menu Item
                  </button>
                  <button
                    className={styles.btnDelete}
                    style={{ borderColor: '#c8a27a', color: '#c8a27a' }}
                    onClick={handleResetAllStock}
                  >
                    🔄 Reset All Stock to Initial
                  </button>
                </div>
              </div>

              {/* Menu Items Table */}
              <div className={styles.stockTableWrapper}>
                <table className={styles.stockTable}>
                  <thead>
                    <tr>
                      <th>Flavor / Item Name</th>
                      <th>Category</th>
                      <th>Price (PKR)</th>
                      <th>Available Stock</th>
                      <th>Initial Stock</th>
                      <th>Active Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {menuItems.map((item) => {
                      const availableVal = stock[item.key]?.available ?? item.available ?? 0;
                      const initialVal = stock[item.key]?.initial ?? item.initial ?? 0;
                      const priceVal = stock[item.key]?.price ?? item.price ?? 0;
                      const activeVal = stock[item.key]?.is_active ?? item.is_active ?? true;

                      return (
                        <tr key={item.key}>
                          <td style={{ fontWeight: 'bold', color: '#f7ece1' }}>
                            {item.name}
                            <div style={{ fontSize: '0.75rem', color: '#a1887f', fontFamily: 'monospace' }}>
                              key: {item.key}
                            </div>
                          </td>
                          <td>
                            <span
                              className={`${styles.categoryBadge} ${
                                item.category === 'premium'
                                  ? styles.categoryPremium
                                  : item.category === 'special'
                                  ? styles.categorySpecial
                                  : styles.categoryClassic
                              }`}
                            >
                              {item.category || 'classic'}
                            </span>
                          </td>
                          <td>
                            <input
                              type="number"
                              value={priceVal}
                              className={styles.stockInput}
                              style={{ width: '90px' }}
                              onChange={(e) => handleStockFieldChange(item.key, 'price', parseInt(e.target.value, 10) || 0)}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              value={availableVal}
                              className={styles.stockInput}
                              style={{ width: '80px' }}
                              onChange={(e) => handleStockFieldChange(item.key, 'available', parseInt(e.target.value, 10) || 0)}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              value={initialVal}
                              className={styles.stockInput}
                              style={{ width: '80px' }}
                              onChange={(e) => handleStockFieldChange(item.key, 'initial', parseInt(e.target.value, 10) || 0)}
                            />
                          </td>
                          <td>
                            <label className={styles.switch}>
                              <input
                                type="checkbox"
                                checked={activeVal}
                                onChange={() => handleStockFieldChange(item.key, 'is_active', !activeVal)}
                              />
                              <span className={styles.slider}></span>
                            </label>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                type="button"
                                className={styles.saveStockBtn}
                                style={{ padding: '6px 12px' }}
                                onClick={() => handleUpdateStockRow(item.key, availableVal, initialVal, priceVal, activeVal)}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                className={styles.btnEdit}
                                onClick={() => setEditingMenuItem({ ...item, available: availableVal, initial: initialVal, price: priceVal, is_active: activeVal })}
                                title="Edit Details & Name"
                              >
                                ✏️
                              </button>
                              <button
                                type="button"
                                className={styles.btnDelete}
                                onClick={() => setItemToDelete(item)}
                                title="Delete from Menu"
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {/* Classic Bundle Row */}
                    <tr>
                      <td style={{ fontWeight: 'bold', color: '#f5cf73' }}>
                        Classic Bundle (Pack of 4)
                        <div style={{ fontSize: '0.75rem', color: '#a1887f' }}>Combo Package</div>
                      </td>
                      <td>
                        <span className={styles.categoryBadge} style={{ background: 'rgba(245, 207, 115, 0.2)', color: '#f5cf73' }}>
                          Bundle
                        </span>
                      </td>
                      <td>
                        <input
                          type="number"
                          value={bundleSettings.classic_bundle.price}
                          className={styles.stockInput}
                          style={{ width: '90px' }}
                          onChange={(e) => setBundleSettings((prev) => ({
                            ...prev,
                            classic_bundle: { ...prev.classic_bundle, price: parseInt(e.target.value, 10) || 0 },
                          }))}
                        />
                      </td>
                      <td colSpan={2}>
                        <span style={{ color: '#9e9e9e', fontSize: '0.8rem', fontStyle: 'italic' }}>
                          Shares stock of Classic cookies
                        </span>
                      </td>
                      <td>
                        <label className={styles.switch}>
                          <input
                            type="checkbox"
                            checked={bundleSettings.classic_bundle.is_active}
                            onChange={(e) => setBundleSettings((prev) => ({
                              ...prev,
                              classic_bundle: { ...prev.classic_bundle, is_active: e.target.checked },
                            }))}
                          />
                          <span className={styles.slider}></span>
                        </label>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={styles.saveStockBtn}
                          style={{ padding: '6px 12px' }}
                          onClick={async () => {
                            await fetch('/api/admin/stock', {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ bundleSettings }),
                            });
                            alert('Classic Bundle settings saved.');
                            loadDashboardData();
                          }}
                        >
                          Save
                        </button>
                      </td>
                    </tr>

                    {/* Premium Bundle Row */}
                    <tr>
                      <td style={{ fontWeight: 'bold', color: '#f5cf73' }}>
                        Premium Bundle (Pack of 4)
                        <div style={{ fontSize: '0.75rem', color: '#a1887f' }}>Combo Package</div>
                      </td>
                      <td>
                        <span className={styles.categoryBadge} style={{ background: 'rgba(245, 207, 115, 0.2)', color: '#f5cf73' }}>
                          Bundle
                        </span>
                      </td>
                      <td>
                        <input
                          type="number"
                          value={bundleSettings.premium_bundle.price}
                          className={styles.stockInput}
                          style={{ width: '90px' }}
                          onChange={(e) => setBundleSettings((prev) => ({
                            ...prev,
                            premium_bundle: { ...prev.premium_bundle, price: parseInt(e.target.value, 10) || 0 },
                          }))}
                        />
                      </td>
                      <td colSpan={2}>
                        <span style={{ color: '#9e9e9e', fontSize: '0.8rem', fontStyle: 'italic' }}>
                          Shares stock of Premium cookies
                        </span>
                      </td>
                      <td>
                        <label className={styles.switch}>
                          <input
                            type="checkbox"
                            checked={bundleSettings.premium_bundle.is_active}
                            onChange={(e) => setBundleSettings((prev) => ({
                              ...prev,
                              premium_bundle: { ...prev.premium_bundle, is_active: e.target.checked },
                            }))}
                          />
                          <span className={styles.slider}></span>
                        </label>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={styles.saveStockBtn}
                          style={{ padding: '6px 12px' }}
                          onClick={async () => {
                            await fetch('/api/admin/stock', {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ bundleSettings }),
                            });
                            alert('Premium Bundle settings saved.');
                            loadDashboardData();
                          }}
                        >
                          Save
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 3: PRE-ORDER ROUNDS & RESET */}
        {/* ============================================================ */}
        {activeTab === 'batches' && (
          <div>
            <section className={styles.stockCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                <div>
                  <h3 className={styles.stockHeader} style={{ margin: 0 }}>
                    <span>📦 Pre-Order Rounds Management (Pre-Order 1, Pre-Order 2, etc.)</span>
                  </h3>
                  <small style={{ fontSize: '0.8rem', color: '#a1887f', display: 'block', marginTop: '4px' }}>
                    Organize customer bookings into distinct rounds, switch active ordering cycles, or reset inventory.
                  </small>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    className={styles.saveStockBtn}
                    onClick={() => {
                      setNewBatchForm({
                        name: `Pre-Order ${batches.length + 1}`,
                        notes: '',
                        resetStock: true,
                        setActive: true,
                      });
                      setShowNewBatchModal(true);
                    }}
                  >
                    ➕ Start New Pre-Order Round
                  </button>
                  <button
                    className={styles.btnDelete}
                    style={{ borderColor: '#c8a27a', color: '#c8a27a' }}
                    onClick={handleResetAllStock}
                  >
                    🔄 1-Click Stock Reset
                  </button>
                </div>
              </div>

              {/* Batches Grid */}
              <div className={styles.batchGrid}>
                {batches.map((b) => {
                  const isActive = b.id === activeBatchId;
                  const stats = batchStats[b.name] || {
                    totalOrders: 0,
                    approvedRevenue: 0,
                    pendingOrders: 0,
                    completedOrders: 0,
                  };

                  return (
                    <div
                      key={b.id}
                      className={`${styles.batchCard} ${isActive ? styles.batchCardActive : ''}`}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '1.2rem', color: '#f7ece1' }}>{b.name}</h4>
                          <span style={{ fontSize: '0.75rem', color: '#a1887f' }}>
                            Created: {new Date(b.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <span
                          className={`${styles.batchTag} ${
                            isActive
                              ? styles.batchTagActive
                              : b.status === 'closed'
                              ? styles.batchTagClosed
                              : styles.batchTagArchived
                          }`}
                        >
                          {isActive ? 'CURRENT ACTIVE' : b.status}
                        </span>
                      </div>

                      {b.notes && (
                        <p style={{ fontSize: '0.8rem', color: '#d7ccc8', margin: '0 0 15px 0', fontStyle: 'italic' }}>
                          "{b.notes}"
                        </p>
                      )}

                      <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '12px', marginBottom: '15px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                          <span style={{ color: '#a1887f' }}>Total Pre-Orders:</span>
                          <strong style={{ color: '#fff' }}>{stats.totalOrders}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                          <span style={{ color: '#a1887f' }}>Approved Revenue:</span>
                          <strong style={{ color: '#a5d6a7' }}>PKR {stats.approvedRevenue.toLocaleString()}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                          <span style={{ color: '#a1887f' }}>Pending Review:</span>
                          <strong style={{ color: '#ffe082' }}>{stats.pendingOrders}</strong>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {!isActive && (
                          <button
                            className={styles.saveStockBtn}
                            style={{ flex: 1, padding: '6px 10px', fontSize: '0.8rem' }}
                            onClick={() => handleSwitchActiveBatch(b.id)}
                          >
                            Set Active
                          </button>
                        )}
                        <button
                          className={styles.btnEdit}
                          style={{ flex: 1, padding: '6px 10px', fontSize: '0.8rem' }}
                          onClick={() => {
                            setBatchFilter(b.name);
                            setActiveTab('orders');
                          }}
                        >
                          View Orders
                        </button>
                        {batches.length > 1 && (
                          <button
                            className={styles.btnDelete}
                            style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                            onClick={() => handleDeleteBatch(b.id, b.name)}
                            title="Delete Batch"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 4: STORE SETTINGS & ANNOUNCEMENT */}
        {/* ============================================================ */}
        {activeTab === 'settings' && (
          <div>
            {/* Fulfillment Options Controls */}
            <section className={styles.stockCard}>
              <h3 className={styles.stockHeader}>
                <span>🛵 Delivery & Pickup Fulfillment Controls</span>
                <small style={{ fontSize: '0.8rem', color: '#a1887f', fontWeight: 'normal', display: 'block', marginTop: '5px' }}>
                  Turn Delivery or Pickup / Takeaway service ON or OFF for customer preorders.
                </small>
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', padding: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '15px 20px',
                      background: '#130c08',
                      borderRadius: '8px',
                      border: '1px solid rgba(200,162,122,0.2)',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#fff' }}>🚚 Delivery Service</div>
                      <div style={{ fontSize: '0.75rem', color: orderSettings.isDeliveryEnabled ? '#81c784' : '#e57373', marginTop: '3px' }}>
                        {orderSettings.isDeliveryEnabled ? 'Status: Active (ON)' : 'Status: Closed (OFF)'}
                      </div>
                    </div>
                    <label className={styles.switch}>
                      <input
                        type="checkbox"
                        checked={orderSettings.isDeliveryEnabled}
                        onChange={(e) => setOrderSettings((prev) => ({ ...prev, isDeliveryEnabled: e.target.checked }))}
                        id="admin-toggle-delivery"
                      />
                      <span className={styles.slider}></span>
                    </label>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '15px 20px',
                      background: '#130c08',
                      borderRadius: '8px',
                      border: '1px solid rgba(200,162,122,0.2)',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#fff' }}>🛍️ Pickup / Takeaway Service</div>
                      <div style={{ fontSize: '0.75rem', color: orderSettings.isPickupEnabled ? '#81c784' : '#e57373', marginTop: '3px' }}>
                        {orderSettings.isPickupEnabled ? 'Status: Active (ON)' : 'Status: Closed (OFF)'}
                      </div>
                    </div>
                    <label className={styles.switch}>
                      <input
                        type="checkbox"
                        checked={orderSettings.isPickupEnabled}
                        onChange={(e) => setOrderSettings((prev) => ({ ...prev, isPickupEnabled: e.target.checked }))}
                        id="admin-toggle-pickup"
                      />
                      <span className={styles.slider}></span>
                    </label>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                  <button
                    type="button"
                    className={styles.saveStockBtn}
                    style={{ padding: '0 25px', height: '40px' }}
                    onClick={handleUpdateOrderSettings}
                    id="admin-save-fulfillment-btn"
                  >
                    Save Fulfillment Settings
                  </button>
                </div>
              </div>
            </section>

            {/* Announcement Banner */}
            <section className={styles.stockCard} style={{ marginTop: '25px' }}>
              <h3 className={styles.stockHeader}>
                <span>📢 Main Page Updates & Announcement Banner</span>
                <small style={{ fontSize: '0.8rem', color: '#a1887f', fontWeight: 'normal', display: 'block', marginTop: '5px' }}>
                  Publish announcements, timing changes, or sold out notices live on the customer preorder form.
                </small>
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', padding: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.85rem', color: '#c8a27a', fontWeight: 'bold' }}>Announcement Text:</label>
                  <textarea
                    value={announcementForm.text}
                    onChange={(e) => setAnnouncementForm((prev) => ({ ...prev, text: e.target.value }))}
                    placeholder="Write your announcement or updates here..."
                    rows="4"
                    style={{
                      width: '100%',
                      background: '#130c08',
                      color: 'white',
                      border: '1px solid rgba(200,162,122,0.2)',
                      borderRadius: '6px',
                      padding: '12px',
                      outline: 'none',
                      fontSize: '0.9rem',
                      lineHeight: '1.5',
                      resize: 'vertical',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '0.85rem', color: '#c8a27a', fontWeight: 'bold' }}>Show Banner on Form:</span>
                    <label className={styles.switch}>
                      <input
                        type="checkbox"
                        checked={announcementForm.isActive}
                        onChange={(e) => setAnnouncementForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                      />
                      <span className={styles.slider}></span>
                    </label>
                  </div>
                  <button
                    type="button"
                    className={styles.saveStockBtn}
                    style={{ padding: '0 25px', height: '40px' }}
                    onClick={handleUpdateAnnouncement}
                  >
                    Save Announcement
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* MODAL: ORDER DETAILS & EDIT */}
      {/* ============================================================ */}
      {selectedOrder && (
        <div className={styles.modalOverlay} onClick={() => setSelectedOrder(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2 style={{ margin: 0, color: '#c8a27a', fontSize: '1.25rem' }}>
                  Preorder Details (Ref: #{selectedOrder.id.substring(0, 8).toUpperCase()})
                </h2>
                <span style={{ fontSize: '0.75rem', color: '#a1887f' }}>
                  Round: <strong>{selectedOrder.batch_name || 'Pre-Order 1'}</strong>
                </span>
              </div>
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
              {isEditing ? (
                <div className={styles.modalGrid}>
                  {/* Column 1: Edit Fields */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div className={styles.infoSection}>
                      <h4 style={{ margin: '0 0 10px 0' }}>👤 Customer & Round Info</h4>
                      <div style={{ marginBottom: '10px' }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#c8a27a', marginBottom: '4px' }}>Assign Pre-Order Round</label>
                        <select
                          value={editForm.batchName}
                          className={styles.stockInput}
                          style={{ width: '100%', height: '36px', background: '#130c08', color: '#fff' }}
                          onChange={(e) => handleEditFormChange('batchName', e.target.value)}
                        >
                          {batches.map((b) => (
                            <option key={b.id} value={b.name}>{b.name}</option>
                          ))}
                        </select>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', color: '#c8a27a', marginBottom: '4px' }}>First Name</label>
                          <input
                            type="text"
                            value={editForm.firstName}
                            className={styles.stockInput}
                            style={{ width: '100%' }}
                            onChange={(e) => handleEditFormChange('firstName', e.target.value)}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', color: '#c8a27a', marginBottom: '4px' }}>Last Name</label>
                          <input
                            type="text"
                            value={editForm.lastName}
                            className={styles.stockInput}
                            style={{ width: '100%' }}
                            onChange={(e) => handleEditFormChange('lastName', e.target.value)}
                          />
                        </div>
                      </div>
                      <div style={{ marginBottom: '10px' }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#c8a27a', marginBottom: '4px' }}>Phone / WhatsApp</label>
                        <input
                          type="text"
                          value={editForm.phone}
                          className={styles.stockInput}
                          style={{ width: '100%' }}
                          onChange={(e) => handleEditFormChange('phone', e.target.value)}
                        />
                      </div>
                      <div style={{ marginBottom: '10px' }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#c8a27a', marginBottom: '4px' }}>Email Address</label>
                        <input
                          type="email"
                          value={editForm.email}
                          className={styles.stockInput}
                          style={{ width: '100%' }}
                          onChange={(e) => handleEditFormChange('email', e.target.value)}
                        />
                      </div>
                      <div style={{ marginBottom: '10px' }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#c8a27a', marginBottom: '4px' }}>Order Type</label>
                        <select
                          value={editForm.orderType}
                          className={styles.stockInput}
                          style={{ width: '100%', height: '36px', background: '#130c08', color: '#fff' }}
                          onChange={(e) => handleEditFormChange('orderType', e.target.value)}
                        >
                          <option value="takeaway">Takeaway</option>
                          <option value="delivery">Delivery</option>
                        </select>
                      </div>
                    </div>

                    {editForm.orderType === 'delivery' && (
                      <div className={styles.infoSection}>
                        <h4 style={{ margin: '0 0 10px 0' }}>🛵 Edit Delivery Location</h4>
                        <div style={{ marginBottom: '10px' }}>
                          <label style={{ display: 'block', fontSize: '0.75rem', color: '#c8a27a', marginBottom: '4px' }}>Street</label>
                          <input
                            type="text"
                            value={editForm.deliveryStreet}
                            className={styles.stockInput}
                            style={{ width: '100%' }}
                            onChange={(e) => handleEditFormChange('deliveryStreet', e.target.value)}
                          />
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                          <label style={{ display: 'block', fontSize: '0.75rem', color: '#c8a27a', marginBottom: '4px' }}>Line 2</label>
                          <input
                            type="text"
                            value={editForm.deliveryStreet2}
                            className={styles.stockInput}
                            style={{ width: '100%' }}
                            onChange={(e) => handleEditFormChange('deliveryStreet2', e.target.value)}
                          />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', color: '#c8a27a', marginBottom: '4px' }}>City</label>
                            <input
                              type="text"
                              value={editForm.deliveryCity}
                              className={styles.stockInput}
                              style={{ width: '100%' }}
                              onChange={(e) => handleEditFormChange('deliveryCity', e.target.value)}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', color: '#c8a27a', marginBottom: '4px' }}>Province</label>
                            <input
                              type="text"
                              value={editForm.deliveryState}
                              className={styles.stockInput}
                              style={{ width: '100%' }}
                              onChange={(e) => handleEditFormChange('deliveryState', e.target.value)}
                            />
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', color: '#c8a27a', marginBottom: '4px' }}>Zip Code</label>
                            <input
                              type="text"
                              value={editForm.deliveryZip}
                              className={styles.stockInput}
                              style={{ width: '100%' }}
                              onChange={(e) => handleEditFormChange('deliveryZip', e.target.value)}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', color: '#c8a27a', marginBottom: '4px' }}>Landmark</label>
                            <input
                              type="text"
                              value={editForm.deliveryLandmark}
                              className={styles.stockInput}
                              style={{ width: '100%' }}
                              onChange={(e) => handleEditFormChange('deliveryLandmark', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Column 2: Edit Payment proof */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div className={styles.infoSection}>
                      <h4 style={{ margin: '0 0 10px 0' }}>📸 Edit Payment Proof Screenshot</h4>
                      <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#c8a27a', marginBottom: '4px' }}>Paste Screenshot Link manually</label>
                        <input
                          type="text"
                          value={editForm.paymentProofUrl}
                          className={styles.stockInput}
                          style={{ width: '100%' }}
                          onChange={(e) => handleEditFormChange('paymentProofUrl', e.target.value)}
                        />
                      </div>
                      <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '15px', borderRadius: '8px', border: '1px dashed rgba(200,162,122,0.2)' }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#c8a27a', marginBottom: '8px', fontWeight: 'bold' }}>
                          Or Upload Replacement Screenshot:
                        </label>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={handleUploadReplacementScreenshot}
                          disabled={isUploading}
                          style={{ fontSize: '0.8rem', color: '#a1887f' }}
                        />
                        {isUploading && <p style={{ color: '#c8a27a', fontSize: '0.75rem', marginTop: '5px' }}>Uploading...</p>}
                      </div>
                      {editForm.paymentProofUrl && (
                        <div style={{ marginTop: '15px' }}>
                          <p style={{ fontSize: '0.75rem', color: '#8d6e63', marginBottom: '5px' }}>Preview:</p>
                          <img
                            src={editForm.paymentProofUrl}
                            alt="Current Edit Preview"
                            style={{ maxWidth: '100%', maxHeight: '180px', borderRadius: '6px', border: '1px solid rgba(200,162,122,0.15)', objectFit: 'contain' }}
                          />
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                      <button
                        onClick={handleSaveEditedOrder}
                        className={`${styles.actionBtn} ${styles.btnApprove}`}
                        style={{ flex: 1 }}
                      >
                        💾 Save Changes
                      </button>
                      <button
                        onClick={() => setIsEditing(false)}
                        className={`${styles.actionBtn} ${styles.btnDecline}`}
                        style={{ flex: 1 }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className={styles.modalGrid}>
                  {/* Column 1: Info */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className={styles.infoSection}>
                      <h4>👤 Customer Details</h4>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Pre-Order Round:</span>
                        <span className={styles.detailValue} style={{ color: '#c8a27a', fontWeight: 'bold' }}>
                          {selectedOrder.batch_name || 'Pre-Order 1'}
                        </span>
                      </div>
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

                  {/* Column 2: Payment Proof Screenshot & Status Actions */}
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
                        >
                          Approve Payment
                        </button>
                        <button
                          onClick={() => handleUpdatePayment(selectedOrder.id, 'rejected')}
                          disabled={selectedOrder.payment_status === 'rejected'}
                          className={`${styles.actionBtn} ${styles.btnDecline}`}
                          style={{ flex: 1 }}
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Bottom Actions */}
              <div className={styles.actionBlock} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
                <div>
                  <button
                    className={styles.bulkBtnDanger}
                    style={{ padding: '10px 16px' }}
                    onClick={() => {
                      setOrderToDelete(selectedOrder);
                      setRestoreStockOnDelete(true);
                    }}
                  >
                    🗑️ Delete Order
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {!isEditing && (
                    <button className={`${styles.actionBtn} ${styles.btnApprove}`} onClick={startEditing}>
                      ✏️ Edit Details
                    </button>
                  )}
                  <button
                    className={`${styles.actionBtn} ${styles.btnClose}`}
                    onClick={() => {
                      setSelectedOrder(null);
                      setIsEditing(false);
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: DELETE ORDER CONFIRMATION */}
      {/* ============================================================ */}
      {orderToDelete && (
        <div className={styles.modalOverlay} onClick={() => setOrderToDelete(null)}>
          <div className={styles.modalContent} style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 style={{ margin: 0, color: '#e57373', fontSize: '1.25rem' }}>
                🗑️ Confirm Order Deletion
              </h2>
              <button
                style={{ background: 'none', border: 'none', color: '#a1887f', fontSize: '1.5rem', cursor: 'pointer' }}
                onClick={() => setOrderToDelete(null)}
              >
                &times;
              </button>
            </div>
            <div className={styles.modalBody}>
              <p style={{ fontSize: '0.95rem', color: '#f7ece1', lineHeight: '1.5' }}>
                {orderToDelete === 'bulk'
                  ? `Are you sure you want to permanently delete ${selectedOrderIds.length} selected orders?`
                  : `Are you sure you want to permanently delete Order #${orderToDelete.id.substring(0, 8).toUpperCase()} for ${orderToDelete.first_name} ${orderToDelete.last_name}?`}
              </p>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '8px', margin: '20px 0', border: '1px solid rgba(200,162,122,0.15)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.9rem', color: '#f5cf73' }}>
                  <input
                    type="checkbox"
                    className={styles.rowCheckbox}
                    checked={restoreStockOnDelete}
                    onChange={(e) => setRestoreStockOnDelete(e.target.checked)}
                  />
                  <span>Restore ordered cookie stock back to inventory</span>
                </label>
                <small style={{ display: 'block', color: '#a1887f', fontSize: '0.75rem', marginTop: '6px' }}>
                  Recommended: Returns the cookies reserved by this order back to available stock.
                </small>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  className={`${styles.actionBtn} ${styles.btnClose}`}
                  onClick={() => setOrderToDelete(null)}
                >
                  Cancel
                </button>
                <button
                  className={styles.bulkBtnDanger}
                  style={{ padding: '10px 20px' }}
                  onClick={handleConfirmDeleteOrder}
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: ADD NEW MENU ITEM */}
      {/* ============================================================ */}
      {showAddMenuModal && (
        <div className={styles.modalOverlay} onClick={() => setShowAddMenuModal(false)}>
          <div className={styles.modalContent} style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 style={{ margin: 0, color: '#c8a27a', fontSize: '1.25rem' }}>➕ Add New Cookie / Menu Item</h2>
              <button
                style={{ background: 'none', border: 'none', color: '#a1887f', fontSize: '1.5rem', cursor: 'pointer' }}
                onClick={() => setShowAddMenuModal(false)}
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleCreateMenuItem} className={styles.modalBody}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#c8a27a', marginBottom: '5px' }}>Cookie / Item Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lotus Cheesecake Cookie"
                  value={menuForm.name}
                  className={styles.stockInput}
                  style={{ width: '100%' }}
                  onChange={(e) => setMenuForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#c8a27a', marginBottom: '5px' }}>Category</label>
                  <select
                    value={menuForm.category}
                    className={styles.stockInput}
                    style={{ width: '100%', height: '38px', background: '#130c08', color: '#fff' }}
                    onChange={(e) => setMenuForm((prev) => ({ ...prev, category: e.target.value }))}
                  >
                    <option value="classic">Classic</option>
                    <option value="premium">Premium</option>
                    <option value="special">Speciality / Other</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#c8a27a', marginBottom: '5px' }}>Price (PKR) *</label>
                  <input
                    type="number"
                    required
                    value={menuForm.price}
                    className={styles.stockInput}
                    style={{ width: '100%' }}
                    onChange={(e) => setMenuForm((prev) => ({ ...prev, price: e.target.value }))}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#c8a27a', marginBottom: '5px' }}>Initial Stock</label>
                  <input
                    type="number"
                    value={menuForm.initialStock}
                    className={styles.stockInput}
                    style={{ width: '100%' }}
                    onChange={(e) => setMenuForm((prev) => ({ ...prev, initialStock: e.target.value, availableStock: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#c8a27a', marginBottom: '5px' }}>Available Stock</label>
                  <input
                    type="number"
                    value={menuForm.availableStock}
                    className={styles.stockInput}
                    style={{ width: '100%' }}
                    onChange={(e) => setMenuForm((prev) => ({ ...prev, availableStock: e.target.value }))}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <label className={styles.switch}>
                  <input
                    type="checkbox"
                    checked={menuForm.isActive}
                    onChange={(e) => setMenuForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                  />
                  <span className={styles.slider}></span>
                </label>
                <span style={{ fontSize: '0.85rem', color: '#f7ece1' }}>Active and visible to customers</span>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className={`${styles.actionBtn} ${styles.btnClose}`}
                  onClick={() => setShowAddMenuModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className={`${styles.actionBtn} ${styles.btnApprove}`}>
                  Add to Menu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: EDIT MENU ITEM */}
      {/* ============================================================ */}
      {editingMenuItem && (
        <div className={styles.modalOverlay} onClick={() => setEditingMenuItem(null)}>
          <div className={styles.modalContent} style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 style={{ margin: 0, color: '#c8a27a', fontSize: '1.25rem' }}>✏️ Edit Menu Item</h2>
              <button
                style={{ background: 'none', border: 'none', color: '#a1887f', fontSize: '1.5rem', cursor: 'pointer' }}
                onClick={() => setEditingMenuItem(null)}
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleSaveEditMenuItem} className={styles.modalBody}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#c8a27a', marginBottom: '5px' }}>Item Name *</label>
                <input
                  type="text"
                  required
                  value={editingMenuItem.name}
                  className={styles.stockInput}
                  style={{ width: '100%' }}
                  onChange={(e) => setEditingMenuItem((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#c8a27a', marginBottom: '5px' }}>Category</label>
                  <select
                    value={editingMenuItem.category || 'classic'}
                    className={styles.stockInput}
                    style={{ width: '100%', height: '38px', background: '#130c08', color: '#fff' }}
                    onChange={(e) => setEditingMenuItem((prev) => ({ ...prev, category: e.target.value }))}
                  >
                    <option value="classic">Classic</option>
                    <option value="premium">Premium</option>
                    <option value="special">Speciality / Other</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#c8a27a', marginBottom: '5px' }}>Price (PKR) *</label>
                  <input
                    type="number"
                    required
                    value={editingMenuItem.price}
                    className={styles.stockInput}
                    style={{ width: '100%' }}
                    onChange={(e) => setEditingMenuItem((prev) => ({ ...prev, price: parseInt(e.target.value, 10) || 0 }))}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#c8a27a', marginBottom: '5px' }}>Available Stock</label>
                  <input
                    type="number"
                    value={editingMenuItem.available}
                    className={styles.stockInput}
                    style={{ width: '100%' }}
                    onChange={(e) => setEditingMenuItem((prev) => ({ ...prev, available: parseInt(e.target.value, 10) || 0 }))}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#c8a27a', marginBottom: '5px' }}>Initial Stock Target</label>
                  <input
                    type="number"
                    value={editingMenuItem.initial}
                    className={styles.stockInput}
                    style={{ width: '100%' }}
                    onChange={(e) => setEditingMenuItem((prev) => ({ ...prev, initial: parseInt(e.target.value, 10) || 0 }))}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <label className={styles.switch}>
                  <input
                    type="checkbox"
                    checked={editingMenuItem.is_active}
                    onChange={(e) => setEditingMenuItem((prev) => ({ ...prev, is_active: e.target.checked }))}
                  />
                  <span className={styles.slider}></span>
                </label>
                <span style={{ fontSize: '0.85rem', color: '#f7ece1' }}>Active and available for customer ordering</span>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className={`${styles.actionBtn} ${styles.btnClose}`}
                  onClick={() => setEditingMenuItem(null)}
                >
                  Cancel
                </button>
                <button type="submit" className={`${styles.actionBtn} ${styles.btnApprove}`}>
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: DELETE MENU ITEM CONFIRMATION */}
      {/* ============================================================ */}
      {itemToDelete && (
        <div className={styles.modalOverlay} onClick={() => setItemToDelete(null)}>
          <div className={styles.modalContent} style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 style={{ margin: 0, color: '#e57373', fontSize: '1.25rem' }}>🗑️ Delete Menu Item</h2>
              <button
                style={{ background: 'none', border: 'none', color: '#a1887f', fontSize: '1.5rem', cursor: 'pointer' }}
                onClick={() => setItemToDelete(null)}
              >
                &times;
              </button>
            </div>
            <div className={styles.modalBody}>
              <p style={{ fontSize: '0.95rem', color: '#f7ece1', lineHeight: '1.5' }}>
                Are you sure you want to permanently delete <strong>{itemToDelete.name}</strong> from the cookie menu? Customers will no longer see or be able to order this item.
              </p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button
                  className={`${styles.actionBtn} ${styles.btnClose}`}
                  onClick={() => setItemToDelete(null)}
                >
                  Cancel
                </button>
                <button
                  className={styles.bulkBtnDanger}
                  style={{ padding: '10px 20px' }}
                  onClick={handleDeleteMenuItem}
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: START NEW PRE-ORDER ROUND */}
      {/* ============================================================ */}
      {showNewBatchModal && (
        <div className={styles.modalOverlay} onClick={() => setShowNewBatchModal(false)}>
          <div className={styles.modalContent} style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 style={{ margin: 0, color: '#c8a27a', fontSize: '1.25rem' }}>🔄 Start New Pre-Order Round</h2>
              <button
                style={{ background: 'none', border: 'none', color: '#a1887f', fontSize: '1.5rem', cursor: 'pointer' }}
                onClick={() => setShowNewBatchModal(false)}
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleCreateBatch} className={styles.modalBody}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#c8a27a', marginBottom: '5px' }}>Round Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pre-Order 2"
                  value={newBatchForm.name}
                  className={styles.stockInput}
                  style={{ width: '100%' }}
                  onChange={(e) => setNewBatchForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#c8a27a', marginBottom: '5px' }}>Notes / Description (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Weekend batch drop"
                  value={newBatchForm.notes}
                  className={styles.stockInput}
                  style={{ width: '100%' }}
                  onChange={(e) => setNewBatchForm((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '8px', marginBottom: '15px', border: '1px solid rgba(200,162,122,0.15)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.85rem', color: '#f7ece1', marginBottom: '10px' }}>
                  <input
                    type="checkbox"
                    className={styles.rowCheckbox}
                    checked={newBatchForm.resetStock}
                    onChange={(e) => setNewBatchForm((prev) => ({ ...prev, resetStock: e.target.checked }))}
                  />
                  <span><strong>Reset all cookie stock to initial targets</strong></span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.85rem', color: '#f7ece1' }}>
                  <input
                    type="checkbox"
                    className={styles.rowCheckbox}
                    checked={newBatchForm.setActive}
                    onChange={(e) => setNewBatchForm((prev) => ({ ...prev, setActive: e.target.checked }))}
                  />
                  <span><strong>Set as current active round for incoming customer pre-orders</strong></span>
                </label>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className={`${styles.actionBtn} ${styles.btnClose}`}
                  onClick={() => setShowNewBatchModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className={`${styles.actionBtn} ${styles.btnApprove}`}>
                  Launch Round
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: CREATE CUSTOM ORDER */}
      {/* ============================================================ */}
      {showCreateModal && (
        <div className={styles.modalOverlay} onClick={() => setShowCreateModal(false)}>
          <div className={styles.modalContent} style={{ maxWidth: '750px' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 style={{ margin: 0, color: '#c8a27a', fontSize: '1.25rem' }}>➕ Create Custom Preorder</h2>
              <button
                style={{ background: 'none', border: 'none', color: '#a1887f', fontSize: '1.5rem', cursor: 'pointer' }}
                onClick={() => setShowCreateModal(false)}
              >
                &times;
              </button>
            </div>
            <div className={styles.modalBody} style={{ maxHeight: '80vh', overflowY: 'auto' }}>
              <div className={styles.modalGrid}>
                {/* Column 1: Customer Details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div className={styles.infoSection}>
                    <h4 style={{ margin: '0 0 10px 0' }}>👤 Customer Information</h4>
                    <div style={{ marginBottom: '10px' }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: '#c8a27a', marginBottom: '4px' }}>Assign to Round *</label>
                      <select
                        value={createForm.batchName}
                        className={styles.stockInput}
                        style={{ width: '100%', height: '36px', background: '#130c08', color: '#fff' }}
                        onChange={(e) => setCreateForm((prev) => ({ ...prev, batchName: e.target.value }))}
                      >
                        {batches.map((b) => (
                          <option key={b.id} value={b.name}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#c8a27a', marginBottom: '4px' }}>First Name *</label>
                        <input
                          type="text"
                          required
                          value={createForm.firstName}
                          className={styles.stockInput}
                          style={{ width: '100%' }}
                          onChange={(e) => setCreateForm((prev) => ({ ...prev, firstName: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#c8a27a', marginBottom: '4px' }}>Last Name</label>
                        <input
                          type="text"
                          value={createForm.lastName}
                          className={styles.stockInput}
                          style={{ width: '100%' }}
                          onChange={(e) => setCreateForm((prev) => ({ ...prev, lastName: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div style={{ marginBottom: '10px' }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: '#c8a27a', marginBottom: '4px' }}>Phone / WhatsApp *</label>
                      <input
                        type="text"
                        required
                        value={createForm.phone}
                        className={styles.stockInput}
                        style={{ width: '100%' }}
                        onChange={(e) => setCreateForm((prev) => ({ ...prev, phone: e.target.value }))}
                      />
                    </div>
                    <div style={{ marginBottom: '10px' }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: '#c8a27a', marginBottom: '4px' }}>Email Address *</label>
                      <input
                        type="email"
                        required
                        value={createForm.email}
                        className={styles.stockInput}
                        style={{ width: '100%' }}
                        onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))}
                      />
                    </div>
                    <div style={{ marginBottom: '10px' }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: '#c8a27a', marginBottom: '4px' }}>Order Type</label>
                      <select
                        value={createForm.orderType}
                        className={styles.stockInput}
                        style={{ width: '100%', height: '36px', background: '#130c08', color: '#fff' }}
                        onChange={(e) => setCreateForm((prev) => ({ ...prev, orderType: e.target.value }))}
                      >
                        <option value="takeaway">Takeaway</option>
                        <option value="delivery">Delivery</option>
                      </select>
                    </div>
                  </div>

                  {createForm.orderType === 'delivery' && (
                    <div className={styles.infoSection}>
                      <h4 style={{ margin: '0 0 10px 0' }}>🛵 Delivery Address</h4>
                      <div style={{ marginBottom: '10px' }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#c8a27a', marginBottom: '4px' }}>Street Address</label>
                        <input
                          type="text"
                          value={createForm.deliveryStreet}
                          className={styles.stockInput}
                          style={{ width: '100%' }}
                          onChange={(e) => setCreateForm((prev) => ({ ...prev, deliveryStreet: e.target.value }))}
                        />
                      </div>
                      <div style={{ marginBottom: '10px' }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#c8a27a', marginBottom: '4px' }}>Line 2 (Optional)</label>
                        <input
                          type="text"
                          value={createForm.deliveryStreet2}
                          className={styles.stockInput}
                          style={{ width: '100%' }}
                          onChange={(e) => setCreateForm((prev) => ({ ...prev, deliveryStreet2: e.target.value }))}
                        />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', color: '#c8a27a', marginBottom: '4px' }}>City</label>
                          <input
                            type="text"
                            value={createForm.deliveryCity}
                            className={styles.stockInput}
                            style={{ width: '100%' }}
                            onChange={(e) => setCreateForm((prev) => ({ ...prev, deliveryCity: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', color: '#c8a27a', marginBottom: '4px' }}>Province</label>
                          <input
                            type="text"
                            value={createForm.deliveryState}
                            className={styles.stockInput}
                            style={{ width: '100%' }}
                            onChange={(e) => setCreateForm((prev) => ({ ...prev, deliveryState: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', color: '#c8a27a', marginBottom: '4px' }}>Zip Code</label>
                          <input
                            type="text"
                            value={createForm.deliveryZip}
                            className={styles.stockInput}
                            style={{ width: '100%' }}
                            onChange={(e) => setCreateForm((prev) => ({ ...prev, deliveryZip: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', color: '#c8a27a', marginBottom: '4px' }}>Landmark</label>
                          <input
                            type="text"
                            value={createForm.deliveryLandmark}
                            className={styles.stockInput}
                            style={{ width: '100%' }}
                            onChange={(e) => setCreateForm((prev) => ({ ...prev, deliveryLandmark: e.target.value }))}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className={styles.infoSection}>
                    <h4 style={{ margin: '0 0 10px 0' }}>⚙️ Status Options</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#c8a27a', marginBottom: '4px' }}>Payment Status</label>
                        <select
                          value={createForm.paymentStatus}
                          className={styles.stockInput}
                          style={{ width: '100%', height: '36px', background: '#130c08', color: '#fff' }}
                          onChange={(e) => setCreateForm((prev) => ({ ...prev, paymentStatus: e.target.value }))}
                        >
                          <option value="pending">Pending</option>
                          <option value="approved">Approved</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#c8a27a', marginBottom: '4px' }}>Order Status</label>
                        <select
                          value={createForm.orderStatus}
                          className={styles.stockInput}
                          style={{ width: '100%', height: '36px', background: '#130c08', color: '#fff' }}
                          onChange={(e) => setCreateForm((prev) => ({ ...prev, orderStatus: e.target.value }))}
                        >
                          <option value="received">Received</option>
                          <option value="preparing">Preparing</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Column 2: Cookie Selections */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div className={styles.infoSection}>
                    <h4 style={{ margin: '0 0 10px 0' }}>🍪 Cookie Catalog Quantities</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px', gap: '10px 15px', alignItems: 'center' }}>
                      {menuItems.map((item) => (
                        <div key={item.key} style={{ display: 'contents' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>
                            {item.name} (PKR {item.price})
                          </span>
                          <input
                            type="number"
                            min="0"
                            value={createFormQuantities[item.key] || 0}
                            className={styles.stockInput}
                            style={{ width: '60px' }}
                            onChange={(e) =>
                              setCreateFormQuantities((prev) => ({
                                ...prev,
                                [item.key]: parseInt(e.target.value, 10) || 0,
                              }))
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                    <button
                      onClick={handleCreateCustomOrder}
                      className={`${styles.actionBtn} ${styles.btnApprove}`}
                      style={{ flex: 1 }}
                    >
                      🚀 Submit Custom Preorder
                    </button>
                    <button
                      onClick={() => setShowCreateModal(false)}
                      className={`${styles.actionBtn} ${styles.btnDecline}`}
                      style={{ flex: 1 }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* ZOOM IMAGE OVERLAY */}
      {/* ============================================================ */}
      {zoomedImg && (
        <div className={styles.zoomOverlay} onClick={() => setZoomedImg(null)}>
          <img src={zoomedImg} alt="Zoomed payment receipt" className={styles.zoomImg} />
        </div>
      )}
    </div>
  );
}
