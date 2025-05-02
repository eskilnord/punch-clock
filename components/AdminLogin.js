// Admin Login Component
const AdminLogin = ({ onLogin }) => {
  const [pin, setPin] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [attempts, setAttempts] = React.useState(0);
  const [locked, setLocked] = React.useState(false);
  const [lockTimer, setLockTimer] = React.useState(0);
  
  // Check if the system is locked due to too many failed attempts
  React.useEffect(() => {
    let interval;
    
    if (locked && lockTimer > 0) {
      interval = setInterval(() => {
        setLockTimer(prev => {
          if (prev <= 1) {
            setLocked(false);
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => clearInterval(interval);
  }, [locked, lockTimer]);
  
  // Handle pin change
  const handlePinChange = (e) => {
    const value = e.target.value;
    // Only allow numbers
    if (/^\d*$/.test(value) && value.length <= 6) {
      setPin(value);
      setError('');
    }
  };
  
  // Handle login
  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (locked) return;
    
    if (pin.length < 4) {
      setError('PIN-koden måste vara minst 4 siffror.');
      return;
    }
    
    setLoading(true);
    
    try {
      const isValid = await dbService.verifyPin(pin);
      
      if (isValid) {
        // Reset attempts on successful login
        setAttempts(0);
        onLogin();
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        
        if (newAttempts >= 5) {
          // Lock system for 5 minutes (300 seconds)
          setLocked(true);
          setLockTimer(300);
          setError('För många felaktiga försök. Systemet är låst i 5 minuter.');
        } else {
          setError(`Felaktig PIN-kod. Du har ${5 - newAttempts} försök kvar.`);
        }
        
        setPin('');
      }
    } catch (err) {
      console.error(err);
      setError('Ett fel uppstod. Försök igen.');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="bg-white p-6 rounded-lg shadow-md max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Admin Login</h2>
      
      <form onSubmit={handleLogin}>
        <div className="mb-4">
          <label htmlFor="pin" className="block text-gray-700 mb-2">PIN-kod</label>
          <input
            type="password"
            id="pin"
            placeholder="Ange PIN-kod"
            value={pin}
            onChange={handlePinChange}
            disabled={loading || locked}
            className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {error && <p className="text-red-500 mt-2">{error}</p>}
          
          {locked && (
            <p className="text-orange-500 mt-2">
              Låst i {Math.floor(lockTimer / 60)}:{(lockTimer % 60).toString().padStart(2, '0')} minuter
            </p>
          )}
        </div>
        
        <button
          type="submit"
          disabled={loading || locked || pin.length < 4}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Loggar in...' : 'Logga in'}
        </button>
      </form>
    </div>
  );
};

// Initial PIN setup component
const InitialSetup = ({ onComplete }) => {
  const [pin, setPin] = React.useState('');
  const [confirmPin, setConfirmPin] = React.useState('');
  const [companyName, setCompanyName] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  
  // Handle pin change
  const handlePinChange = (e, field) => {
    const value = e.target.value;
    // Only allow numbers
    if (/^\d*$/.test(value) && value.length <= 6) {
      if (field === 'pin') {
        setPin(value);
      } else {
        setConfirmPin(value);
      }
      setError('');
    }
  };
  
  // Handle setup submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (pin.length < 4) {
      setError('PIN-koden måste vara minst 4 siffror.');
      return;
    }
    
    if (pin !== confirmPin) {
      setError('PIN-koderna matchar inte.');
      return;
    }
    
    setLoading(true);
    
    try {
      // Save PIN and company name
      await dbService.savePin(pin);
      
      if (companyName.trim()) {
        await dbService.saveConfig('companyName', companyName.trim());
      }
      
      onComplete();
    } catch (err) {
      console.error(err);
      setError('Ett fel uppstod. Försök igen.');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="bg-white p-6 rounded-lg shadow-md max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Första konfiguration</h2>
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="companyName" className="block text-gray-700 mb-2">Företagsnamn (valfritt)</label>
          <input
            type="text"
            id="companyName"
            placeholder="Företagsnamn"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div className="mb-4">
          <label htmlFor="pin" className="block text-gray-700 mb-2">PIN-kod (4-6 siffror)</label>
          <input
            type="password"
            id="pin"
            placeholder="Ange PIN-kod"
            value={pin}
            onChange={(e) => handlePinChange(e, 'pin')}
            className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div className="mb-4">
          <label htmlFor="confirmPin" className="block text-gray-700 mb-2">Bekräfta PIN-kod</label>
          <input
            type="password"
            id="confirmPin"
            placeholder="Bekräfta PIN-kod"
            value={confirmPin}
            onChange={(e) => handlePinChange(e, 'confirmPin')}
            className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {error && <p className="text-red-500 mt-2">{error}</p>}
        </div>
        
        <button
          type="submit"
          disabled={loading || pin.length < 4 || pin !== confirmPin}
          className="w-full bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-md transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Sparar...' : 'Spara konfiguration'}
        </button>
      </form>
    </div>
  );
};

// Export components
window.AdminLogin = AdminLogin;
window.InitialSetup = InitialSetup; 