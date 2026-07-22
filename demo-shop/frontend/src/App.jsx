import { useState, useEffect } from 'react';
import { ShoppingCart, Skull, Zap, AlertTriangle, XCircle, Terminal, Package, CreditCard, Loader2 } from 'lucide-react';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';


function App() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkoutStatus, setCheckoutStatus] = useState(null); // null, 'loading', 'success', 'error'
  const [chaosPanelOpen, setChaosPanelOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Chaos State
  const [dbLocked, setDbLocked] = useState(false);
  const [paymentOutage, setPaymentOutage] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API_URL}/products`);
      const data = await res.json();
      setProducts(data);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch products', err);
      setLoading(false);
    }
  };

  const addToCart = (product) => {
    setCart([...cart, product]);
  };

  const checkout = async () => {
    if (cart.length === 0) return;
    setCheckoutStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetch(`${API_URL}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cart, total: cart.reduce((sum, p) => sum + p.price, 0) })
      });
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }
      await res.json();
      setCheckoutStatus('success');
      setCart([]);
      setTimeout(() => setCheckoutStatus(null), 3000);
    } catch (err) {
      setCheckoutStatus('error');
      setErrorMsg(err.message);
      setTimeout(() => setCheckoutStatus(null), 5000);
    }
  };

  // Chaos Actions
  const toggleDbLock = async () => {
    const res = await fetch(`${API_URL}/chaos/toggle-db-lock`, { method: 'POST' });
    const data = await res.json();
    setDbLocked(data.dbLocked);
  };

  const togglePaymentOutage = async () => {
    const res = await fetch(`${API_URL}/chaos/toggle-payment-outage`, { method: 'POST' });
    const data = await res.json();
    setPaymentOutage(data.paymentOutage);
  };

  const triggerCrash = async () => {
    fetch(`${API_URL}/chaos/crash`, { method: 'POST' });
    alert('Crash payload sent. The backend is going down in 500ms.');
  };

  const triggerTrafficSpike = async () => {
    alert('Blasting backend with 100 requests...');
    for (let i = 0; i < 100; i++) {
      fetch(`${API_URL}/products`).catch(() => {});
    }
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="logo">
          <Terminal size={24} color="#22d3ee" />
          <h1>DevOps Swag Shop</h1>
        </div>
        <div className="cart-icon">
          <ShoppingCart size={24} />
          {cart.length > 0 && <span className="cart-badge">{cart.length}</span>}
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {loading ? (
          <div className="loading-state">
            <Loader2 className="spinner" size={48} />
            <p>Loading products...</p>
          </div>
        ) : (
          <div className="products-grid">
            {products.map((product) => (
              <div key={product.id} className="product-card">
                <div className="product-icon">
                  <Package size={48} color="#94a3b8" />
                </div>
                <h3>{product.name}</h3>
                <p className="price">${product.price.toFixed(2)}</p>
                <button className="add-btn" onClick={() => addToCart(product)}>
                  Add to Cart
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Cart Section */}
        {cart.length > 0 && (
          <div className="cart-section">
            <h2>Your Cart</h2>
            <div className="cart-summary">
              <p>{cart.length} items</p>
              <p className="cart-total">Total: ${cart.reduce((sum, p) => sum + p.price, 0).toFixed(2)}</p>
            </div>
            
            <button 
              className={`checkout-btn ${checkoutStatus}`} 
              onClick={checkout}
              disabled={checkoutStatus === 'loading'}
            >
              {checkoutStatus === 'loading' ? (
                <><Loader2 className="spinner" size={18} /> Processing...</>
              ) : checkoutStatus === 'success' ? (
                'Payment Successful!'
              ) : (
                <><CreditCard size={18} /> Checkout Now</>
              )}
            </button>
            {checkoutStatus === 'error' && (
              <p className="error-message">⚠️ Checkout Failed: {errorMsg}</p>
            )}
          </div>
        )}
      </main>

      {/* Footer & Secret Chaos Button */}
      <footer className="footer">
        <p>© 2026 DevOps Swag Shop. Powered by LogAI.</p>
        <button 
          className="secret-chaos-btn" 
          onClick={() => setChaosPanelOpen(!chaosPanelOpen)}
          title="Open Chaos Control Panel"
        >
          <Skull size={16} />
        </button>
      </footer>

      {/* Chaos Control Panel Overlay */}
      {chaosPanelOpen && (
        <div className="chaos-overlay">
          <div className="chaos-panel">
            <div className="chaos-header">
              <h2><Zap size={24} color="#eab308" /> Chaos Control Panel</h2>
              <button className="close-btn" onClick={() => setChaosPanelOpen(false)}>×</button>
            </div>
            <p className="chaos-desc">Inject failures directly into the backend to trigger LogAI monitoring and alerts.</p>
            
            <div className="chaos-actions">
              <div className="chaos-card warning">
                <h3><AlertTriangle size={18} /> Database Lock</h3>
                <p>Simulates a heavy query locking the `orders` table. Causes checkout to take 5000ms.</p>
                <button className={`toggle-btn ${dbLocked ? 'active' : ''}`} onClick={toggleDbLock}>
                  {dbLocked ? 'Disable DB Lock' : 'Enable DB Lock'}
                </button>
              </div>

              <div className="chaos-card error">
                <h3><XCircle size={18} /> Payment Gateway Outage</h3>
                <p>Simulates Stripe/PayPal being down. Causes 502 errors on checkout.</p>
                <button className={`toggle-btn ${paymentOutage ? 'active' : ''}`} onClick={togglePaymentOutage}>
                  {paymentOutage ? 'Disable Payment Outage' : 'Enable Payment Outage'}
                </button>
              </div>

              <div className="chaos-card critical">
                <h3><Skull size={18} /> Fatal Crash</h3>
                <p>Forces an unhandled exception, crashing the Node.js process completely.</p>
                <button className="trigger-btn critical" onClick={triggerCrash}>
                  Crash Backend
                </button>
              </div>

              <div className="chaos-card info">
                <h3><Zap size={18} /> Traffic Spike (DDoS)</h3>
                <p>Spams the backend with 100 concurrent requests to test ingestion limits.</p>
                <button className="trigger-btn" onClick={triggerTrafficSpike}>
                  Generate Traffic
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
